import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { JOB_STATUS } from '../../../shared/constants/statuses.js';
import { analyzeJobDescription } from '../../ai/job-analyzer.service.js';
import { getCompanyContext, jobScopeWhere, canAccessJob } from '../companies/companyContext.js';
import { resolveJobClientLink } from '../clients/clients.service.js';

// async function getCompanyIdForUser(userId) {
//   const company = await prisma.company.findUnique({ where: { userId } });
//   if (!company) throw ApiError.notFound('Company profile not found');
//   return company.id;
// }
// Build plan P2: resolved through the shared company context (member first,
// Company.userId fallback) — same result for owners as before.
async function getCompanyIdForUser(userId) {
  const ctx = await getCompanyContext(userId);
  return ctx.companyId;
}

// Creates the job immediately, then augments it with AI-extracted structured
// requirements (Section 12). AI analysis failure should never block job
// creation — it degrades gracefully and can be re-run later.
export async function createJob(userId, jobData) {
  // const companyId = await getCompanyIdForUser(userId);
  const ctx = await getCompanyContext(userId);
  const companyId = ctx.companyId;
  // Build plan P3: optional Client → Department → HR link, validated as a chain.
  const clientLink = await resolveJobClientLink(companyId, jobData);

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
      // Build plan P4
      autoAdvanceOnMatch: jobData.autoAdvanceOnMatch ?? false,
      // Build plan P5
      interviewFlow: jobData.interviewFlow ?? 'SLOT',
      inviteValidDays: jobData.inviteValidDays ?? 7,
      ...clientLink,
    },
  });

  // Build plan P2: a recruiter who creates a job is assigned to it.
  if (!ctx.isOwner && ctx.memberId) {
    await prisma.jobRecruiter.create({ data: { jobId: job.id, memberId: ctx.memberId } });
  }

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
  // Build plan P3: {} when the request doesn't touch the client link.
  const clientLink = await resolveJobClientLink(job.companyId, jobData, job);
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
      // Build plan P4
      autoAdvanceOnMatch: jobData.autoAdvanceOnMatch ?? job.autoAdvanceOnMatch,
      // Build plan P5
      interviewFlow: jobData.interviewFlow ?? job.interviewFlow,
      inviteValidDays: jobData.inviteValidDays ?? job.inviteValidDays,
      ...clientLink,
    },
  });
}

// Build plan P3: company-side view of a job's client link.
export async function getJobClientLink(userId, jobId) {
  const job = await getOwnedJob(userId, jobId);
  const full = await prisma.job.findUnique({
    where: { id: job.id },
    select: {
      clientCompany: { select: { id: true, name: true, isActive: true } },
      department: { select: { id: true, name: true, isActive: true } },
      hiringPerson: { select: { id: true, fullName: true, email: true, designation: true, isActive: true } },
    },
  });
  return full;
}

export async function closeJob(userId, jobId) {
  const job = await getOwnedJob(userId, jobId);
  return prisma.job.update({ where: { id: job.id }, data: { status: JOB_STATUS.CLOSED } });
}

// async function getOwnedJob(userId, jobId) {
//   const companyId = await getCompanyIdForUser(userId);
//   const job = await prisma.job.findUnique({ where: { id: jobId } });
//   if (!job) throw ApiError.notFound('Job not found');
//   if (job.companyId !== companyId) throw ApiError.forbidden('You do not own this job');
//   return job;
// }
// Build plan P2: same checks for owners; a recruiter additionally needs to
// be assigned to the job (or have created it).
async function getOwnedJob(userId, jobId) {
  const ctx = await getCompanyContext(userId);
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.companyId !== ctx.companyId) throw ApiError.forbidden('You do not own this job');
  if (!(await canAccessJob(ctx, userId, job))) {
    throw ApiError.forbidden('You are not assigned to this job', 'JOB_NOT_ASSIGNED');
  }
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

// export async function listCompanyJobs(userId) {
export async function listCompanyJobs(userId, { clientId } = {}) {
  // const companyId = await getCompanyIdForUser(userId);
  // Build plan P2: recruiters only see their own/assigned jobs.
  const ctx = await getCompanyContext(userId);
  // Build plan P3: optional client filter; "none" = jobs without a client.
  const clientFilter = clientId === 'none' ? { clientCompanyId: null } : clientId ? { clientCompanyId: clientId } : {};
  return prisma.job.findMany({
    // where: { companyId },
    where: { AND: [jobScopeWhere(ctx, userId), clientFilter] },
    // include: { _count: { select: { applications: true } } },
    include: {
      _count: { select: { applications: true } },
      clientCompany: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
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
