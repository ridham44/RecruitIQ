import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { getCompanyContext } from '../companies/companyContext.js';
import { getOwnedJob } from '../jobs/jobs.service.js';
import { screenApplicationById } from '../screening/screening.service.js';

// Build plan P4 (§6B) — "CV pool": CVs submitted through this company's
// careers portal without choosing a job, with their AI job matches. Because
// matching searches every company's jobs, matches at OTHER companies are
// shown only as a score, never with the other company's job or name.

function serializeSubmission(s, companyId) {
  const results = Array.isArray(s.matchResults) ? s.matchResults : [];
  return {
    id: s.id,
    status: s.status,
    createdAt: s.createdAt,
    candidate: {
      id: s.candidate.id,
      fullName: s.candidate.fullName,
      email: s.candidate.user.email,
      phone: s.candidate.phone,
      phoneVerified: Boolean(s.candidate.phoneVerifiedAt),
    },
    resume: { id: s.resume.id, fileName: s.resume.fileName, skills: s.resume.parsedData?.skills || [] },
    matches: results.map((r) =>
      r.companyId === companyId
        ? { ownJob: true, jobId: r.jobId, jobTitle: r.jobTitle, score: r.score, preScore: r.preScore, passes: r.passes, threshold: r.threshold }
        : { ownJob: false, score: r.score, passes: r.passes }
    ),
    placement: s.application
      ? {
          applicationId: s.application.id,
          status: s.application.status,
          ownJob: s.application.job.companyId === companyId,
          ...(s.application.job.companyId === companyId
            ? { jobId: s.application.job.id, jobTitle: s.application.job.title }
            : { jobTitle: null }),
        }
      : null,
  };
}

const INCLUDE = {
  candidate: { include: { user: { select: { email: true } } } },
  resume: { select: { id: true, fileName: true, parsedData: true } },
  application: { select: { id: true, status: true, job: { select: { id: true, title: true, companyId: true } } } },
};

export async function listPool(userId, { status } = {}) {
  const ctx = await getCompanyContext(userId);
  const rows = await prisma.cvSubmission.findMany({
    where: { companyId: ctx.companyId, ...(status ? { status } : {}) },
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return rows.map((r) => serializeSubmission(r, ctx.companyId));
}

// A recruiter can place a pooled CV on one of their own jobs by hand.
export async function applyToJob(userId, submissionId, jobId) {
  const ctx = await getCompanyContext(userId);
  const submission = await prisma.cvSubmission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.companyId !== ctx.companyId) throw ApiError.notFound('CV not found');
  const job = await getOwnedJob(userId, jobId);
  if (job.status !== 'OPEN') throw ApiError.badRequest('This job is not accepting applications', 'JOB_NOT_OPEN');

  const existing = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId: submission.candidateId, jobId } },
  });
  if (existing) throw ApiError.conflict('This candidate already has an application for that job', 'ALREADY_APPLIED');

  const application = await prisma.application.create({
    data: { candidateId: submission.candidateId, jobId, resumeId: submission.resumeId, source: 'AUTO_MATCH' },
  });
  if (!submission.applicationId) {
    await prisma.cvSubmission.update({ where: { id: submissionId }, data: { applicationId: application.id, status: 'MATCHED' } });
  }
  try {
    await screenApplicationById(application.id);
  } catch (err) {
    console.error('[cv-pool] screening failed:', err.message);
  }

  const row = await prisma.cvSubmission.findUnique({ where: { id: submissionId }, include: INCLUDE });
  return { submission: serializeSubmission(row, ctx.companyId), applicationId: application.id };
}
