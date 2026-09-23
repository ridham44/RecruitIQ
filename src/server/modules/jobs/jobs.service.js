import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { JOB_STATUS } from '../../../shared/constants/statuses.js';
import { analyzeJobDescription } from '../../ai/job-analyzer.service.js';

async function getCompanyIdForUser(userId) {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) throw ApiError.notFound('Company profile not found');
  return company.id;
}

// Creates the job immediately, then augments it with AI-extracted structured
// requirements (Section 12). AI analysis failure should never block job
// creation — it degrades gracefully and can be re-run later.
export async function createJob(userId, jobData) {
  const companyId = await getCompanyIdForUser(userId);

  const job = await prisma.job.create({
    data: {
      companyId,
      createdBy: userId,
      title: jobData.title,
      description: jobData.description,
      minimumExperience: jobData.minimumExperience,
      maximumExperience: jobData.maximumExperience ?? null,
      requiredSkills: jobData.requiredSkills,
      preferredSkills: jobData.preferredSkills,
      educationRequirements: jobData.educationRequirements,
      location: jobData.location || null,
      employmentType: jobData.employmentType,
      workMode: jobData.workMode || 'On-site',
      openings: jobData.numberOfOpenings ?? jobData.openings ?? 1,
      jobLevel: jobData.jobLevel || 'Mid',
      noticePeriod: jobData.noticePeriod || null,
      languagesRequired: jobData.languagesRequired || [],
      certifications: jobData.certifications || [],
      salaryRange: jobData.salaryRange || null,
      status: jobData.status,
      minAcceptableScore: jobData.minAcceptableScore,
      autoRejectBelowMinScore: jobData.autoRejectBelowMinScore,
    },
  });

  try {
    const analysis = await analyzeJobDescription({ title: job.title, description: job.description });
    return await prisma.job.update({
      where: { id: job.id },
      data: {
        structuredRequirements: analysis,
        // Merge AI-derived skills with whatever the company explicitly entered.
        requiredSkills: Array.from(new Set([...job.requiredSkills, ...analysis.requiredSkills])),
        preferredSkills: Array.from(new Set([...job.preferredSkills, ...analysis.preferredSkills])),
      },
    });
  } catch (err) {
    console.error('[jobs] AI analysis failed, keeping job as-is:', err.message);
    return job;
  }
}

export async function updateJob(userId, jobId, jobData) {
  const job = await getOwnedJob(userId, jobId);
  return prisma.job.update({
    where: { id: job.id },
    data: {
      title: jobData.title ?? job.title,
      description: jobData.description ?? job.description,
      minimumExperience: jobData.minimumExperience ?? job.minimumExperience,
      maximumExperience: jobData.maximumExperience ?? job.maximumExperience,
      requiredSkills: jobData.requiredSkills ?? job.requiredSkills,
      preferredSkills: jobData.preferredSkills ?? job.preferredSkills,
      educationRequirements: jobData.educationRequirements ?? job.educationRequirements,
      location: jobData.location ?? job.location,
      employmentType: jobData.employmentType ?? job.employmentType,
      workMode: jobData.workMode ?? job.workMode,
      openings: jobData.numberOfOpenings ?? jobData.openings ?? job.openings,
      jobLevel: jobData.jobLevel ?? job.jobLevel,
      noticePeriod: jobData.noticePeriod !== undefined ? jobData.noticePeriod : job.noticePeriod,
      languagesRequired: jobData.languagesRequired ?? job.languagesRequired,
      certifications: jobData.certifications ?? job.certifications,
      salaryRange: jobData.salaryRange !== undefined ? jobData.salaryRange : job.salaryRange,
      status: jobData.status ?? job.status,
      minAcceptableScore: jobData.minAcceptableScore ?? job.minAcceptableScore,
      autoRejectBelowMinScore: jobData.autoRejectBelowMinScore ?? job.autoRejectBelowMinScore,
    },
  });
}

export async function closeJob(userId, jobId) {
  const job = await getOwnedJob(userId, jobId);
  return prisma.job.update({ where: { id: job.id }, data: { status: JOB_STATUS.CLOSED } });
}

async function getOwnedJob(userId, jobId) {
  const companyId = await getCompanyIdForUser(userId);
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.companyId !== companyId) throw ApiError.forbidden('You do not own this job');
  return job;
}

export async function listOpenJobs({ search } = {}) {
  return prisma.job.findMany({
    where: {
      status: JOB_STATUS.OPEN,
      ...(search
        ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] }
        : {}),
    },
    include: { company: { select: { name: true, logoUrl: true, location: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listCompanyJobs(userId) {
  const companyId = await getCompanyIdForUser(userId);
  return prisma.job.findMany({
    where: { companyId },
    include: { _count: { select: { applications: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getJobById(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { company: { select: { name: true, logoUrl: true, location: true, website: true } } },
  });
  if (!job) throw ApiError.notFound('Job not found');
  return job;
}

export { getOwnedJob, getCompanyIdForUser };
