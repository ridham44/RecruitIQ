import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

// Build plan P2: the single place that answers "which recruitment company
// does this user work for, and as what?". Every company-side ownership check
// (jobs.service getCompanyIdForUser/getOwnedJob, companies.service
// getCompanyByUserId) goes through here.
//
// Looks up CompanyMember first; falls back to Company.userId so an owner the
// P2 backfill somehow missed still gets exactly the access they had before.
//
// Returns { companyId, company, memberId, role, permissions, isOwner }.
export async function getCompanyContext(userId) {
  const member = await prisma.companyMember.findUnique({
    where: { userId },
    include: { company: true },
  });
  if (member) {
    return {
      companyId: member.companyId,
      company: member.company,
      memberId: member.id,
      role: member.role,
      permissions: member.permissions,
      isOwner: member.role === 'OWNER',
      isActive: member.isActive,
    };
  }

  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) throw ApiError.notFound('Company profile not found');
  return {
    companyId: company.id,
    company,
    memberId: null,
    role: 'OWNER',
    permissions: [],
    isOwner: true,
    isActive: true,
  };
}

// Prisma `where` for the jobs this user may see. The owner sees every job
// of the company (unchanged); a recruiter sees jobs assigned to them plus
// jobs they created themselves.
export function jobScopeWhere(ctx, userId) {
  if (ctx.isOwner) return { companyId: ctx.companyId };
  return {
    companyId: ctx.companyId,
    OR: [{ createdBy: userId }, { recruiters: { some: { memberId: ctx.memberId } } }],
  };
}

export async function canAccessJob(ctx, userId, job) {
  if (job.companyId !== ctx.companyId) return false;
  if (ctx.isOwner) return true;
  if (job.createdBy === userId) return true;
  const assignment = await prisma.jobRecruiter.findUnique({
    where: { jobId_memberId: { jobId: job.id, memberId: ctx.memberId } },
  });
  return Boolean(assignment);
}
