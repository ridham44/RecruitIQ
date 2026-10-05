import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { JOB_STATUS } from '../../../shared/constants/statuses.js';
import { analyzeJobDescription } from '../../ai/job-analyzer.service.js';
import { analysisToJobFields } from '../../../shared/schemas/job-analysis.schema.js';
import { inviteAllShortlisted } from '../interviews/instantInterview.service.js';
import { getCompanyContext, jobScopeWhere, canAccessJob } from '../companies/companyContext.js';
import { resolveJobClientLink } from '../clients/clients.service.js';
import { ensureJobSlug } from '../recq/recq.slug.js';

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

// Case-insensitive merge that keeps the user's spelling first.
function mergeTags(mine, extra) {
  const seen = new Set(mine.map((v) => v.toLowerCase()));
  return [...mine, ...extra.filter((v) => !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()))].slice(0, 40);
}

// Values from the description for the fields the user never touched. A field
// the user set is never overwritten, and the experience range stays valid.
function autoFilledFields(job, analysis, autoFillFields = []) {
  const found = analysisToJobFields(analysis);
  const out = Object.fromEntries(autoFillFields.filter((k) => k in found).map((k) => [k, found[k]]));
  const min = out.minimumExperience ?? job.minimumExperience;
  const max = 'maximumExperience' in out ? out.maximumExperience : job.maximumExperience;
  if (max != null && max < min) {
    delete out.minimumExperience;
    delete out.maximumExperience;
  }
  return out;
}

// AI read of a description for the "Auto-fill from description" button.
export async function extractJobDetails({ title, description }) {
  const analysis = await analyzeJobDescription({ title, description });
  return {
    fields: analysisToJobFields(analysis),
    requiredSkills: analysis.requiredSkills,
    preferredSkills: analysis.preferredSkills,
    summary: analysis.summary,
  };
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
      // Build plan P9 — /recq interview window
      interviewAvailabilityStart: jobData.interviewAvailabilityStart ?? null,
      interviewAvailabilityEnd: jobData.interviewAvailabilityEnd ?? null,
      // Build plan P7
      finalThreshold: jobData.finalThreshold ?? null,
      cvWeight: jobData.cvWeight ?? 0.3,
      interviewWeight: jobData.interviewWeight ?? 0.7,
      autoSubmitToClient: jobData.autoSubmitToClient ?? false,
      ...clientLink,
    },
  });

  // Build plan P2: a recruiter who creates a job is assigned to it.
  if (!ctx.isOwner && ctx.memberId) {
    await prisma.jobRecruiter.create({ data: { jobId: job.id, memberId: ctx.memberId } });
  }

  let result = job;
  try {
    const analysis = await analyzeJobDescription({ title: job.title, description: job.description });
    result = await prisma.job.update({
      where: { id: job.id },
      data: {
        structuredRequirements: analysis,
        // Merge AI-derived skills with whatever the company explicitly entered.
        requiredSkills: mergeTags(job.requiredSkills, analysis.requiredSkills),
        preferredSkills: mergeTags(job.preferredSkills, analysis.preferredSkills),
        ...autoFilledFields(job, analysis, jobData.autoFillFields),
      },
    });
  } catch (err) {
    console.error('[jobs] AI analysis failed, keeping job as-is:', err.message);
  }

  // Build plan P9: give the job a shareable /recq/:agency/:jobSlug link now,
  // so recruiters can share it the moment the job exists.
  try {
    const slug = await ensureJobSlug(result.id);
    result = { ...result, slug };
  } catch (err) {
    console.error('[jobs] slug generation failed:', err.message);
  }
  return result;
}

export async function updateJob(userId, jobId, jobData) {
  const job = await getOwnedJob(userId, jobId);
  // The schema can only compare fields sent together; check the result here.
  const minimumExperience = jobData.minimumExperience ?? job.minimumExperience;
  const maximumExperience = jobData.maximumExperience !== undefined ? jobData.maximumExperience : job.maximumExperience;
  if (maximumExperience != null && maximumExperience < minimumExperience) {
    throw ApiError.badRequest("Maximum experience can't be less than minimum experience", 'VALIDATION_ERROR', {
      maximumExperience: "Maximum experience can't be less than minimum experience",
    });
  }
  const cvWeight = jobData.cvWeight ?? job.cvWeight;
  const interviewWeight = jobData.interviewWeight ?? job.interviewWeight;
  if (Math.abs(cvWeight + interviewWeight - 1) > 0.001) {
    throw ApiError.badRequest('CV weight and interview weight must add up to 100%', 'VALIDATION_ERROR', {
      interviewWeight: 'CV weight and interview weight must add up to 100%',
    });
  }
  // Build plan P3: {} when the request doesn't touch the client link.
  const clientLink = await resolveJobClientLink(job.companyId, jobData, job);
  const updated = await prisma.job.update({
    where: { id: job.id },
    data: {
      title: jobData.title ?? job.title,
      description: jobData.description ?? job.description,
      minimumExperience,
      maximumExperience,
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
      // Build plan P9 — /recq interview window (undefined leaves unchanged,
      // null clears it).
      interviewAvailabilityStart:
        jobData.interviewAvailabilityStart !== undefined ? jobData.interviewAvailabilityStart : job.interviewAvailabilityStart,
      interviewAvailabilityEnd:
        jobData.interviewAvailabilityEnd !== undefined ? jobData.interviewAvailabilityEnd : job.interviewAvailabilityEnd,
      // Build plan P7 (null clears the threshold)
      finalThreshold: jobData.finalThreshold !== undefined ? jobData.finalThreshold : job.finalThreshold,
      cvWeight: jobData.cvWeight ?? job.cvWeight,
      interviewWeight: jobData.interviewWeight ?? job.interviewWeight,
      autoSubmitToClient: jobData.autoSubmitToClient ?? job.autoSubmitToClient,
      ...clientLink,
    },
  });

  // Switched to instant links: everyone already shortlisted gets theirs now.
  if (job.interviewFlow !== 'INSTANT' && updated.interviewFlow === 'INSTANT') {
    const instantInvites = await inviteAllShortlisted(updated.id);
    return { ...updated, instantInvites };
  }
  return updated;
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

// What candidates and the public may see of a job — never scoring settings,
// thresholds, client links or who created it.
const PUBLIC_JOB_SELECT = {
  id: true,
  title: true,
  description: true,
  minimumExperience: true,
  maximumExperience: true,
  requiredSkills: true,
  preferredSkills: true,
  educationRequirements: true,
  location: true,
  employmentType: true,
  workMode: true,
  openings: true,
  jobLevel: true,
  noticePeriod: true,
  languagesRequired: true,
  certifications: true,
  salaryRange: true,
  status: true,
  interviewFlow: true,
  createdAt: true,
  companyId: true,
};
const PUBLIC_JOB_WHERE = { status: JOB_STATUS.OPEN, company: { status: 'ACTIVE' } };
const PUBLIC_JOBS_LIMIT = 200;

export async function listOpenJobs({ search } = {}) {
  return prisma.job.findMany({
    where: {
      ...PUBLIC_JOB_WHERE,
      ...(search
        ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] }
        : {}),
    },
    select: { ...PUBLIC_JOB_SELECT, company: { select: { name: true, logoUrl: true, location: true } } },
    orderBy: { createdAt: 'desc' },
    take: PUBLIC_JOBS_LIMIT,
  });
}

export async function getPublicJobById(jobId) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, ...PUBLIC_JOB_WHERE },
    select: { ...PUBLIC_JOB_SELECT, company: { select: { name: true, logoUrl: true, location: true, website: true } } },
  });
  if (!job) throw ApiError.notFound('Job not found');
  return job;
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

export { getOwnedJob, getCompanyIdForUser };
