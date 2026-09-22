import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPLICATION_STATUS, SCREENING_STATUS } from '../../../shared/constants/statuses.js';
import { matchCandidateToJob } from '../../ai/candidate-matcher.service.js';
import { computeSkillOverlap, computeExperienceScore, computeEducationScore } from './deterministic.util.js';
import { getOwnedJob } from '../jobs/jobs.service.js';
import { sendApplicationStatusEmail } from '../notifications/email.service.js';

function blend(deterministicScore, aiScore, deterministicWeight = 0.6) {
  return Math.round(deterministicScore * deterministicWeight + aiScore * (1 - deterministicWeight));
}

// Job + candidate resume -> deterministic checks + AI semantic match ->
// persisted ScreeningResult (Section 13). This is the single place the two
// signals are combined, so the composition is transparent and easy to tune.
async function screenApplication(application) {
  const { job, resume, candidate } = application;
  const resumeData = resume.parsedData || {};

  const skillOverlap = computeSkillOverlap(resumeData.skills, [...job.requiredSkills, ...job.preferredSkills]);
  const requiredOverlap = computeSkillOverlap(resumeData.skills, job.requiredSkills);
  const experienceCheck = computeExperienceScore(
    resumeData.totalExperienceYears,
    job.minimumExperience,
    job.maximumExperience
  );
  const educationCheck = computeEducationScore(resumeData.education, job.educationRequirements);

  let ai;
  try {
    ai = await matchCandidateToJob({ job, resumeData, resumeText: resume.rawText });
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

  const skillMatchScore = blend(skillOverlap.score, ai.skillMatchScore);
  const experienceMatchScore = blend(experienceCheck.score, ai.experienceMatchScore);
  const educationMatchScore = blend(educationCheck.score, ai.educationMatchScore);
  const overallScore = Math.round(skillMatchScore * 0.5 + experienceMatchScore * 0.3 + educationMatchScore * 0.2);

  const matchedSkills = Array.from(new Set([...skillOverlap.matched, ...ai.matchedSkills]));
  const missingSkills = Array.from(new Set([...requiredOverlap.missing, ...ai.missingSkills]));

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
  if (application.status !== APPLICATION_STATUS.SHORTLISTED) {
    const newStatus =
      job.autoRejectBelowMinScore && overallScore < job.minAcceptableScore
        ? APPLICATION_STATUS.REJECTED
        : APPLICATION_STATUS.SCREENING;
    await prisma.application.update({ where: { id: application.id }, data: { status: newStatus } });

    // Auto-reject is a real status change from the candidate's point of
    // view, same as a manual bulk reject — notify them the same way.
    if (newStatus === APPLICATION_STATUS.REJECTED) {
      await sendApplicationStatusEmail({ ...application, status: newStatus });
    }
  }

  return result;
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
      status: { not: APPLICATION_STATUS.SHORTLISTED },
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
