import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPLICATION_STATUS, JOB_STATUS } from '../../../shared/constants/statuses.js';
import { getOwnedJob } from '../jobs/jobs.service.js';

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

  return prisma.application.create({
    data: { candidateId, jobId, resumeId, status: APPLICATION_STATUS.APPLIED },
    include: { job: true, resume: true },
  });
}

export async function listMyApplications(userId) {
  const candidateId = await getCandidateIdForUser(userId);
  return prisma.application.findMany({
    where: { candidateId },
    include: { job: { include: { company: { select: { name: true, logoUrl: true } } } }, screeningResult: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMyApplicationById(userId, applicationId) {
  const candidateId = await getCandidateIdForUser(userId);
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { include: { company: true } }, resume: true, screeningResult: true },
  });
  if (!application || application.candidateId !== candidateId) {
    throw ApiError.notFound('Application not found');
  }
  return application;
}

export async function listApplicationsForJob(userId, jobId) {
  await getOwnedJob(userId, jobId);
  return prisma.application.findMany({
    where: { jobId },
    include: { candidate: true, resume: true, screeningResult: true },
    orderBy: [{ screeningResult: { overallScore: 'desc' } }, { createdAt: 'desc' }],
  });
}

// Combined candidate detail for a company reviewing one applicant against a
// specific job (resume, structured resume data, and screening result) —
// backs the /company/jobs/:id/candidates/:candidateId page.
export async function getCandidateApplicationDetail(userId, jobId, candidateId) {
  await getOwnedJob(userId, jobId);

  const application = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
    include: { candidate: true, resume: true, job: true, screeningResult: true },
  });

  if (!application) throw ApiError.notFound('Application not found');
  return application;
}
