import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPLICATION_STATUS, JOB_STATUS, candidateFacingStatus } from '../../../shared/constants/statuses.js';
import { getOwnedJob } from '../jobs/jobs.service.js';
import { sendApplicationStatusEmail } from '../notifications/email.service.js';
import { getEffectiveConfig } from '../interviews/interviewConfig.service.js';
import { screenApplicationById } from '../screening/screening.service.js';
import { env } from '../../config/env.js';
import { inviteApplication } from '../interviews/instantInterview.service.js';
import { storage } from '../../resume/storage/index.js';

async function getCandidateIdForUser(userId) {
  const candidate = await prisma.candidate.findUnique({ where: { userId } });
  if (!candidate) throw ApiError.notFound('Candidate profile not found');
  return candidate.id;
}

export async function applyToJob(userId, { jobId, resumeId }) {
  const candidateId = await getCandidateIdForUser(userId);

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== JOB_STATUS.OPEN) {
    throw ApiError.badRequest('This job is not accepting applications', 'JOB_NOT_OPEN');
  }

  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume || resume.candidateId !== candidateId) {
    throw ApiError.badRequest('Resume not found for this candidate', 'RESUME_NOT_FOUND');
  }

  const existing = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
  });
  if (existing) throw ApiError.conflict('You have already applied to this job', 'ALREADY_APPLIED');

  // return prisma.application.create({
  //   data: { candidateId, jobId, resumeId, status: APPLICATION_STATUS.APPLIED },
  //   include: { job: true, resume: true },
  // });
  const application = await prisma.application.create({
    data: { candidateId, jobId, resumeId, status: APPLICATION_STATUS.APPLIED },
    include: { job: true, resume: true },
  });

  // Build plan P4 (§8): only jobs that opted into autoAdvanceOnMatch screen on
  // apply. Every other job returns exactly as before (status APPLIED, the
  // company runs screening). A screening failure never fails the apply.
  if (!job.autoAdvanceOnMatch) return application;
  try {
    await screenApplicationById(application.id);
  } catch (err) {
    console.error('[applications] auto-screening on apply failed:', err.message);
  }
  return prisma.application.findUnique({ where: { id: application.id }, include: { job: true, resume: true } });
}

// Build plan P7: candidates see post-interview decisions (qualified / not
// qualified / submitted to client) as INTERVIEW_COMPLETED, and never the
// combined final score.
export function needsInstantLink(application) {
  return (
    env.features.instantInterview &&
    application.status === APPLICATION_STATUS.SHORTLISTED &&
    application.job?.interviewFlow === 'INSTANT'
  );
}

function forCandidate({ finalScore, finalScoredAt, ...application }) {
  return { ...application, status: candidateFacingStatus(application.status) };
}

export async function listMyApplications(userId) {
  const candidateId = await getCandidateIdForUser(userId);
  // return prisma.application.findMany({
  const applications = await prisma.application.findMany({
    where: { candidateId },
    include: { job: { include: { company: { select: { name: true, logoUrl: true } } } }, screeningResult: true },
    orderBy: { createdAt: 'desc' },
  });
  return applications.map(forCandidate);
}

// Candidate-facing AI interviewer persona (Section 4: "AI Interview —
// Priya, Virtual HR") — a subset of the company's AiInterviewConfig safe to
// show before any interview exists, so the candidate knows who they're
// scheduling with before picking a slot.
export async function getMyApplicationById(userId, applicationId) {
  const candidateId = await getCandidateIdForUser(userId);
  const load = () =>
    prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { include: { company: true } }, resume: true, screeningResult: true },
    });
  let application = await load();
  if (!application || application.candidateId !== candidateId) {
    throw ApiError.notFound('Application not found');
  }
  // Shortlisted on an instant-link job but no link yet (e.g. shortlisted
  // before the job switched to instant links): create it now, so the
  // candidate never waits for a link that isn't coming.
  if (needsInstantLink(application)) {
    try {
      await inviteApplication(application.id);
      application = await load();
    } catch (err) {
      console.error('[applications] on-demand instant link failed:', err.message);
    }
  }
  const { aiName, aiTitle } = await getEffectiveConfig(application.jobId);
  // return { ...application, aiInterviewConfig: { aiName, aiTitle } };
  return { ...forCandidate(application), aiInterviewConfig: { aiName, aiTitle } };
}

export async function listApplicationsForJob(userId, jobId) {
  await getOwnedJob(userId, jobId);
  return prisma.application.findMany({
    where: { jobId },
    include: { candidate: true, resume: true, screeningResult: true },
    orderBy: [{ screeningResult: { overallScore: 'desc' } }, { createdAt: 'desc' }],
  });
}

// Bulk manual Shortlist/Reject action (scoped to a single job so an
// applicationId from a different company's job can never be touched — the
// `jobId` filter combined with getOwnedJob's ownership check is what
// enforces that, not just the id list itself). Sends a status-change email
// to every affected candidate (Section: Phase 2 candidate flow) — a failed
// send never fails this request, see email.service.js.
export async function bulkUpdateApplicationStatus(userId, jobId, { applicationIds, status }) {
  await getOwnedJob(userId, jobId);

  // Only applicants still being decided can change. Booked, interviewed or
  // submitted ones are skipped (moving them would orphan their interview),
  // and ones already in the target status aren't re-emailed.
  const decidable = [
    APPLICATION_STATUS.APPLIED,
    APPLICATION_STATUS.SCREENING,
    APPLICATION_STATUS.SHORTLISTED,
    APPLICATION_STATUS.REJECTED,
  ].filter((s) => s !== status);
  const eligible = await prisma.application.findMany({
    where: { id: { in: applicationIds }, jobId, status: { in: decidable } },
    select: { id: true, status: true },
  });

  const changedIds = [];
  for (const app of eligible) {
    const { count } = await prisma.application.updateMany({
      where: { id: app.id, status: app.status },
      data: { status },
    });
    if (count) changedIds.push(app.id);
  }
  const result = { count: changedIds.length };

  const updatedApplications = await prisma.application.findMany({
    where: { id: { in: changedIds } },
    include: { candidate: { include: { user: true } }, job: { include: { company: true } } },
  });
  // await Promise.all(updatedApplications.map(sendApplicationStatusEmail));
  // On an INSTANT-flow job a manual shortlist emails the interview link
  // (same as an auto-shortlist in screening.service.js); everything else —
  // and a failed invite — gets the usual status email.
  await Promise.all(updatedApplications.map(notifyStatusChange));

  return { updatedCount: result.count, skippedCount: applicationIds.length - result.count };
}

async function notifyStatusChange(application) {
  const instant =
    application.status === APPLICATION_STATUS.SHORTLISTED && application.job.interviewFlow === 'INSTANT' && env.features.instantInterview;
  if (instant) {
    try {
      const { sent } = await inviteApplication(application.id);
      if (sent?.sent !== false) return;
    } catch (err) {
      console.error('[applications] instant interview invite failed:', err.message);
    }
  }
  await sendApplicationStatusEmail(application);
}

async function fetchOwnedApplication(userId, applicationId) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { candidate: { include: { user: true } }, job: { include: { company: true } } },
  });
  if (!application) throw ApiError.notFound('Application not found');
  await getOwnedJob(userId, application.jobId); // authorization: company must own the job
  return application;
}

// Single-candidate reject action (per-row "Reject" button). Kept separate
// from bulkUpdateApplicationStatus so a direct API call can be rejected
// with a real 409 instead of silently no-op'ing like updateMany would.
export async function rejectApplication(userId, applicationId) {
  const application = await fetchOwnedApplication(userId, applicationId);

  if (application.status === APPLICATION_STATUS.REJECTED) {
    throw ApiError.conflict('This application has already been rejected', 'ALREADY_REJECTED');
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: APPLICATION_STATUS.REJECTED },
  });

  await sendApplicationStatusEmail({ ...application, status: APPLICATION_STATUS.REJECTED });

  return updated;
}

// Combined candidate detail for a company reviewing one applicant against a
// specific job (resume, structured resume data, and screening result) —
// backs the /company/jobs/:id/candidates/:candidateId page.
// CV file of a candidate who applied to this job. getOwnedJob enforces the
// agency (and, for recruiters, the job assignment).
export async function getCandidateCv(userId, jobId, candidateId) {
  await getOwnedJob(userId, jobId);
  const application = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
    include: { resume: true },
  });
  if (!application?.resume) throw ApiError.notFound('CV not found');
  const { resume } = application;
  return { buffer: await storage.read(resume.storageKey), fileName: resume.fileName || 'cv', fileType: resume.fileType };
}

export async function getCandidateApplicationDetail(userId, jobId, candidateId) {
  await getOwnedJob(userId, jobId);

  const application = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
    include: {
      candidate: { include: { educations: { orderBy: [{ startYear: 'asc' }, { createdAt: 'asc' }] } } },
      resume: true,
      job: true,
      screeningResult: true,
    },
  });

  if (!application) throw ApiError.notFound('Application not found');
  return application;
}
