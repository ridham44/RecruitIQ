import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPLICATION_STATUS, SCREENING_STATUS, POST_INTERVIEW_STATUSES } from '../../../shared/constants/statuses.js';
import { matchCandidateToJob } from '../../ai/candidate-matcher.service.js';
import { computeSkillOverlap, computeExperienceScore, computeEducationScore } from './deterministic.util.js';
import { getOwnedJob } from '../jobs/jobs.service.js';
import { sendApplicationStatusEmail } from '../notifications/email.service.js';
import { inviteApplication } from '../interviews/instantInterview.service.js';

function blend(deterministicScore, aiScore, deterministicWeight = 0.6) {
  return Math.round(deterministicScore * deterministicWeight + aiScore * (1 - deterministicWeight));
}

// ─── Original single-function version, kept for reference (build plan P4
// split it into computeMatch + screenApplication without changing the math):
//
// async function screenApplication(application) {
//   const { job, resume, candidate } = application;
//   const resumeData = resume.parsedData || {};
//
//   const skillOverlap = computeSkillOverlap(resumeData.skills, [...job.requiredSkills, ...job.preferredSkills]);
//   const requiredOverlap = computeSkillOverlap(resumeData.skills, job.requiredSkills);
//   const experienceCheck = computeExperienceScore(
//     resumeData.totalExperienceYears,
//     job.minimumExperience,
//     job.maximumExperience
//   );
//   const educationCheck = computeEducationScore(resumeData.education, job.educationRequirements);
//
//   let ai;
//   try {
//     ai = await matchCandidateToJob({ job, resumeData, resumeText: resume.rawText });
//   } catch (err) {
//     return prisma.screeningResult.upsert({ …status: FAILED, errorMessage: err.message… });
//   }
//
//   const skillMatchScore = blend(skillOverlap.score, ai.skillMatchScore);
//   const experienceMatchScore = blend(experienceCheck.score, ai.experienceMatchScore);
//   const educationMatchScore = blend(educationCheck.score, ai.educationMatchScore);
//   const overallScore = Math.round(skillMatchScore * 0.5 + experienceMatchScore * 0.3 + educationMatchScore * 0.2);
//
//   const matchedSkills = Array.from(new Set([...skillOverlap.matched, ...ai.matchedSkills]));
//   const missingSkills = Array.from(new Set([...requiredOverlap.missing, ...ai.missingSkills]));
//   …persist exactly as below…
// }

// Job + resume -> deterministic checks + AI semantic match -> scores. The
// single place the two signals are combined (Section 13). Throws when the AI
// call fails. Build plan P4: also used by best-job matching for CV-only
// submissions, which have no Application yet.
export async function computeMatch(job, resume) {
  const resumeData = resume.parsedData || {};

  const skillOverlap = computeSkillOverlap(resumeData.skills, [...job.requiredSkills, ...job.preferredSkills]);
  const requiredOverlap = computeSkillOverlap(resumeData.skills, job.requiredSkills);
  const experienceCheck = computeExperienceScore(
    resumeData.totalExperienceYears,
    job.minimumExperience,
    job.maximumExperience
  );
  const educationCheck = computeEducationScore(resumeData.education, job.educationRequirements);

  const ai = await matchCandidateToJob({ job, resumeData, resumeText: resume.rawText });

  const skillMatchScore = blend(skillOverlap.score, ai.skillMatchScore);
  const experienceMatchScore = blend(experienceCheck.score, ai.experienceMatchScore);
  const educationMatchScore = blend(educationCheck.score, ai.educationMatchScore);
  const overallScore = Math.round(skillMatchScore * 0.5 + experienceMatchScore * 0.3 + educationMatchScore * 0.2);

  const matchedSkills = Array.from(new Set([...skillOverlap.matched, ...ai.matchedSkills]));
  const missingSkills = Array.from(new Set([...requiredOverlap.missing, ...ai.missingSkills]));

  return {
    ai,
    skillOverlap,
    requiredOverlap,
    experienceCheck,
    educationCheck,
    skillMatchScore,
    experienceMatchScore,
    educationMatchScore,
    overallScore,
    matchedSkills,
    missingSkills,
  };
}

// Persists a ScreeningResult and applies the job's decision settings.
// `precomputed` (build plan P4) lets best-job matching reuse the score it
// already paid an AI call for instead of scoring the same pair twice.
async function screenApplication(application, precomputed = null) {
  const { job, resume } = application;

  let match;
  try {
    match = precomputed ?? (await computeMatch(job, resume));
  } catch (err) {
    return prisma.screeningResult.upsert({
      where: { applicationId: application.id },
      create: {
        applicationId: application.id,
        status: SCREENING_STATUS.FAILED,
        errorMessage: err.message,
      },
      update: { status: SCREENING_STATUS.FAILED, errorMessage: err.message },
    });
  }

  const {
    ai,
    skillOverlap,
    requiredOverlap,
    experienceCheck,
    educationCheck,
    skillMatchScore,
    experienceMatchScore,
    educationMatchScore,
    overallScore,
    matchedSkills,
    missingSkills,
  } = match;

  const result = await prisma.screeningResult.upsert({
    where: { applicationId: application.id },
    create: {
      applicationId: application.id,
      status: SCREENING_STATUS.COMPLETED,
      overallScore,
      skillMatchScore,
      experienceMatchScore,
      educationMatchScore,
      matchedSkills,
      missingSkills,
      strengths: ai.strengths,
      concerns: ai.concerns,
      reasoning: ai.reasoning,
      deterministicChecks: {
        skillOverlap: { score: skillOverlap.score, matched: skillOverlap.matched, missing: skillOverlap.missing },
        requiredSkillsOnly: { score: requiredOverlap.score, missing: requiredOverlap.missing },
        experience: experienceCheck,
        education: educationCheck,
      },
      aiModel: env.openRouterModel,
      screenedAt: new Date(),
    },
    update: {
      status: SCREENING_STATUS.COMPLETED,
      overallScore,
      skillMatchScore,
      experienceMatchScore,
      educationMatchScore,
      matchedSkills,
      missingSkills,
      strengths: ai.strengths,
      concerns: ai.concerns,
      reasoning: ai.reasoning,
      deterministicChecks: {
        skillOverlap: { score: skillOverlap.score, matched: skillOverlap.matched, missing: skillOverlap.missing },
        requiredSkillsOnly: { score: requiredOverlap.score, missing: requiredOverlap.missing },
        experience: experienceCheck,
        education: educationCheck,
      },
      aiModel: env.openRouterModel,
      errorMessage: null,
      screenedAt: new Date(),
    },
  });

  // Screening never auto-shortlists — only an optional auto-reject, gated by
  // the job's own settings (Job.minAcceptableScore/autoRejectBelowMinScore).
  // Everything else is left as SCREENING for the company to decide on
  // manually or via the bulk Shortlist/Reject actions. A manual SHORTLISTED
  // decision (only ever set via the bulk-status endpoint) is never
  // overwritten by (re-)screening, so re-running screening after tweaking
  // these settings can't silently undo a company's prior decision.
  // if (application.status !== APPLICATION_STATUS.SHORTLISTED) {
  // Build plan P7: post-interview decisions (qualified / submitted) are never
  // overwritten by a re-screen either.
  if (application.status !== APPLICATION_STATUS.SHORTLISTED && !POST_INTERVIEW_STATUSES.includes(application.status)) {
    // const newStatus =
    //   job.autoRejectBelowMinScore && overallScore < job.minAcceptableScore
    //     ? APPLICATION_STATUS.REJECTED
    //     : APPLICATION_STATUS.SCREENING;
    // Build plan P4 (§8): a job that opted into autoAdvanceOnMatch decides
    // both ways on the score. Every other job keeps the rule above verbatim.
    const newStatus = job.autoAdvanceOnMatch
      ? overallScore >= job.minAcceptableScore
        ? APPLICATION_STATUS.SHORTLISTED
        : APPLICATION_STATUS.REJECTED
      : job.autoRejectBelowMinScore && overallScore < job.minAcceptableScore
        ? APPLICATION_STATUS.REJECTED
        : APPLICATION_STATUS.SCREENING;
    await prisma.application.update({ where: { id: application.id }, data: { status: newStatus } });

    // Auto-reject is a real status change from the candidate's point of
    // view, same as a manual bulk reject — notify them the same way.
    // if (newStatus === APPLICATION_STATUS.REJECTED) {
    // Build plan P4: auto-shortlist notifies too (same email as a manual shortlist).
    // Build plan P5: on an INSTANT-flow job the shortlist email is replaced
    // by the interview-link email (falls back to the normal one on failure).
    const instantInvite =
      newStatus === APPLICATION_STATUS.SHORTLISTED && job.interviewFlow === 'INSTANT' && env.features.instantInterview;
    let invited = false;
    if (instantInvite) {
      try {
        const { sent } = await inviteApplication(application.id);
        invited = sent?.sent !== false;
      } catch (err) {
        console.error('[screening] instant interview invite failed:', err.message);
      }
    }
    if ((newStatus === APPLICATION_STATUS.REJECTED || newStatus === APPLICATION_STATUS.SHORTLISTED) && !invited) {
      await sendApplicationStatusEmail({ ...application, status: newStatus });
    }
  }

  return result;
}

// Build plan P4: screen one application without a company user (auto
// screening on apply, guest apply, best-job placement). Idempotent: an
// application that already has a COMPLETED result, or was decided
// (SHORTLISTED/REJECTED), is left alone.
export async function screenApplicationById(applicationId, { precomputed = null } = {}) {
  const application = await fetchApplicationForScreening(applicationId);
  if (application.screeningResult?.status === SCREENING_STATUS.COMPLETED) return application.screeningResult;
  if (
    application.status === APPLICATION_STATUS.SHORTLISTED ||
    application.status === APPLICATION_STATUS.REJECTED ||
    POST_INTERVIEW_STATUSES.includes(application.status) // build plan P7
  ) {
    return application.screeningResult;
  }
  await prisma.application.update({ where: { id: application.id }, data: { status: APPLICATION_STATUS.SCREENING } });
  return screenApplication({ ...application, status: APPLICATION_STATUS.SCREENING }, precomputed);
}

async function fetchApplicationForScreening(applicationId) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { include: { company: true } }, resume: true, candidate: { include: { user: true } }, screeningResult: true },
  });
  if (!application) throw ApiError.notFound('Application not found');
  return application;
}

export async function runScreeningForApplication(userId, applicationId) {
  const application = await fetchApplicationForScreening(applicationId);
  await getOwnedJob(userId, application.jobId); // authorization: company must own the job

  // Rejection is terminal — without this, screening would flip a REJECTED
  // application's status back to SCREENING (see the status-write at the end
  // of screenApplication, which only special-cases SHORTLISTED).
  if (application.status === APPLICATION_STATUS.REJECTED) {
    throw ApiError.badRequest('Cannot screen a rejected application', 'APPLICATION_REJECTED');
  }

  // Guard against re-screening a candidate that's already been scored —
  // the per-row "Screen Candidate" button must be a one-shot action
  // enforced here, not just disabled client-side.
  if (application.screeningResult?.status === SCREENING_STATUS.COMPLETED) {
    throw ApiError.conflict('This candidate has already been screened', 'ALREADY_SCREENED');
  }

  await prisma.application.update({
    where: { id: application.id },
    data: { status: APPLICATION_STATUS.SCREENING },
  });

  return screenApplication(application);
}

// Runs screening for every not-yet-screened application on a job
// (Section 14). Executed sequentially to stay well within a single
// serverless function's execution time budget rather than firing dozens of
// concurrent OpenRouter calls.
//
// "Not yet screened" is determined by the ScreeningResult itself (missing or
// not COMPLETED), NOT by Application.status — since SCREENING is now also
// the resting status for "scored, awaiting a manual decision" (see
// screenApplication above), filtering on status here would re-screen
// already-scored applications on every run.
//
// Pass `force: true` to instead re-screen EVERY application on the job
// (e.g. after changing Job.minAcceptableScore/autoRejectBelowMinScore, so
// the new settings actually take effect on already-scored candidates)
// rather than only the pending ones. SHORTLISTED applications are always
// excluded either way — that's a manual decision screening never revisits.
export async function runScreeningForJob(userId, jobId, { force = false } = {}) {
  await getOwnedJob(userId, jobId);

  const applications = await prisma.application.findMany({
    where: {
      jobId,
      // status: { not: APPLICATION_STATUS.SHORTLISTED },
      // Build plan P7: also never re-screen post-interview decisions.
      status: { notIn: [APPLICATION_STATUS.SHORTLISTED, ...POST_INTERVIEW_STATUSES] },
      ...(force ? {} : { OR: [{ screeningResult: null }, { screeningResult: { status: { not: SCREENING_STATUS.COMPLETED } } }] }),
    },
    include: { job: { include: { company: true } }, resume: true, candidate: { include: { user: true } } },
  });

  const results = [];
  for (const application of applications) {
    await prisma.application.update({
      where: { id: application.id },
      data: { status: APPLICATION_STATUS.SCREENING },
    });
    results.push(await screenApplication(application));
  }

  return { screenedCount: results.length };
}

export async function getRankedCandidates(userId, jobId, { limit } = {}) {
  await getOwnedJob(userId, jobId);

  const applications = await prisma.application.findMany({
    where: { jobId },
    include: {
      candidate: true,
      resume: true,
      screeningResult: true,
    },
  });

  const ranked = applications
    .filter((a) => a.screeningResult?.status === SCREENING_STATUS.COMPLETED)
    .sort((a, b) => (b.screeningResult.overallScore ?? 0) - (a.screeningResult.overallScore ?? 0));

  const unscreened = applications.filter((a) => a.screeningResult?.status !== SCREENING_STATUS.COMPLETED);

  return {
    ranked: (limit ? ranked.slice(0, limit) : ranked).map((a, index) => ({ rank: index + 1, application: a })),
    totalScreened: ranked.length,
    unscreened,
  };
}
