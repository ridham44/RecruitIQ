import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, TX_OPTIONS } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { ASSIGNABLE_PERMISSIONS } from '../../../shared/constants/permissions.js';
import { getCompanyContext } from '../companies/companyContext.js';
import { issuePasswordToken, hasPendingInvite } from '../auth/passwordToken.service.js';
import { sendAccountSetupEmail } from '../notifications/email.service.js';

// Build plan P2 — the owner (or a recruiter with MANAGE_RECRUITERS) invites
// recruiters, sets their permissions and assigns them to jobs. Everything is
// scoped to the caller's own recruitment company.

const MEMBER_INCLUDE = {
  user: { select: { id: true, email: true, isActive: true, createdAt: true } },
  jobAssignments: { include: { job: { select: { id: true, title: true, status: true } } } },
  // Build plan P3
  clientAssignments: { include: { clientCompany: { select: { id: true, name: true, isActive: true } } } },
};

async function serializeMember(member) {
  return {
    id: member.id,
    role: member.role,
    fullName: member.fullName,
    email: member.user.email,
    userId: member.userId,
    // A member is usable only while both the membership and the login are active.
    isActive: member.isActive && member.user.isActive,
    permissions: member.role === 'OWNER' ? ASSIGNABLE_PERMISSIONS : member.permissions,
    jobs: member.jobAssignments.map((a) => a.job),
    clients: (member.clientAssignments || []).map((a) => a.clientCompany),
    pendingInvite: member.role === 'OWNER' ? false : await hasPendingInvite(member.userId),
    createdAt: member.createdAt,
  };
}

async function loadMember(ctx, memberId) {
  const member = await prisma.companyMember.findUnique({ where: { id: memberId }, include: MEMBER_INCLUDE });
  if (!member || member.companyId !== ctx.companyId) throw ApiError.notFound('Agency recruiter not found');
  return member;
}

// Nobody edits the owner through this module, and nobody edits their own
// membership (prevents a recruiter from granting themselves permissions).
function assertEditable(ctx, member) {
  if (member.role === 'OWNER') throw ApiError.badRequest("The agency owner can't be changed here", 'OWNER_NOT_EDITABLE');
  if (member.id === ctx.memberId) throw ApiError.badRequest("You can't change your own access", 'CANNOT_CHANGE_SELF');
}

async function assertJobsInCompany(companyId, jobIds) {
  if (!jobIds.length) return;
  const count = await prisma.job.count({ where: { id: { in: jobIds }, companyId } });
  if (count !== new Set(jobIds).size) throw ApiError.badRequest('One or more jobs were not found', 'INVALID_JOB');
}

export async function listMembers(userId) {
  const ctx = await getCompanyContext(userId);
  const members = await prisma.companyMember.findMany({
    where: { companyId: ctx.companyId },
    include: MEMBER_INCLUDE,
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
  return Promise.all(members.map(serializeMember));
}

export async function inviteRecruiter(userId, { email, fullName, permissions, jobIds }) {
  const ctx = await getCompanyContext(userId);
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  await assertJobsInCompany(ctx.companyId, jobIds);

  const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const { memberId, link } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: normalizedEmail, passwordHash: unusablePasswordHash, role: ROLES.RECRUITER },
    });
    const member = await tx.companyMember.create({
      data: {
        companyId: ctx.companyId,
        userId: user.id,
        role: 'RECRUITER',
        fullName: fullName.trim(),
        permissions: [...new Set(permissions)],
      },
    });
    if (jobIds.length) {
      await tx.jobRecruiter.createMany({
        data: [...new Set(jobIds)].map((jobId) => ({ jobId, memberId: member.id })),
        skipDuplicates: true,
      });
    }
    const invite = await issuePasswordToken(user.id, { tx });
    return { memberId: member.id, link: invite.link };
  }, TX_OPTIONS);

  await sendAccountSetupEmail({ to: normalizedEmail, companyName: ctx.company.name, link, asRecruiter: true });

  return { recruiter: await serializeMember(await loadMember(ctx, memberId)), setupLink: link };
}

export async function updateRecruiter(userId, memberId, { fullName }) {
  const ctx = await getCompanyContext(userId);
  const member = await loadMember(ctx, memberId);
  assertEditable(ctx, member);
  await prisma.companyMember.update({ where: { id: memberId }, data: { fullName: fullName.trim() } });
  return serializeMember(await loadMember(ctx, memberId));
}

// Deactivation turns off both the membership and the login; the recruiter's
// jobs and assignments are kept so the owner can reassign them.
export async function setRecruiterStatus(userId, memberId, isActive) {
  const ctx = await getCompanyContext(userId);
  const member = await loadMember(ctx, memberId);
  assertEditable(ctx, member);
  await prisma.$transaction([
    prisma.companyMember.update({ where: { id: memberId }, data: { isActive } }),
    prisma.user.update({ where: { id: member.userId }, data: { isActive } }),
  ]);
  return serializeMember(await loadMember(ctx, memberId));
}

export async function setRecruiterPermissions(userId, memberId, permissions) {
  const ctx = await getCompanyContext(userId);
  const member = await loadMember(ctx, memberId);
  assertEditable(ctx, member);
  await prisma.companyMember.update({ where: { id: memberId }, data: { permissions: [...new Set(permissions)] } });
  return serializeMember(await loadMember(ctx, memberId));
}

export async function setRecruiterJobs(userId, memberId, jobIds) {
  const ctx = await getCompanyContext(userId);
  const member = await loadMember(ctx, memberId);
  if (member.role === 'OWNER') throw ApiError.badRequest('The agency owner already sees every job', 'OWNER_NOT_EDITABLE');
  const unique = [...new Set(jobIds)];
  await assertJobsInCompany(ctx.companyId, unique);
  await prisma.$transaction([
    prisma.jobRecruiter.deleteMany({ where: { memberId, jobId: { notIn: unique } } }),
    prisma.jobRecruiter.createMany({ data: unique.map((jobId) => ({ jobId, memberId })), skipDuplicates: true }),
  ]);
  return serializeMember(await loadMember(ctx, memberId));
}

export async function resendRecruiterInvite(userId, memberId) {
  const ctx = await getCompanyContext(userId);
  const member = await loadMember(ctx, memberId);
  assertEditable(ctx, member);
  if (!(await hasPendingInvite(member.userId))) {
    throw ApiError.badRequest('This agency recruiter has already set a password', 'INVITE_NOT_PENDING');
  }
  const { link } = await issuePasswordToken(member.userId);
  await sendAccountSetupEmail({ to: member.user.email, companyName: ctx.company.name, link, asRecruiter: true });
  return { setupLink: link };
}

// ─── Job-side view: who works this job ───

async function loadCompanyJob(ctx, jobId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.companyId !== ctx.companyId) throw ApiError.notFound('Job not found');
  return job;
}

export async function listJobRecruiters(userId, jobId) {
  const ctx = await getCompanyContext(userId);
  await loadCompanyJob(ctx, jobId);
  const rows = await prisma.jobRecruiter.findMany({
    where: { jobId },
    include: { member: { include: MEMBER_INCLUDE } },
    orderBy: { createdAt: 'asc' },
  });
  return Promise.all(rows.map((r) => serializeMember(r.member)));
}

export async function setJobRecruiters(userId, jobId, memberIds) {
  const ctx = await getCompanyContext(userId);
  await loadCompanyJob(ctx, jobId);
  const unique = [...new Set(memberIds)];
  if (unique.length) {
    const count = await prisma.companyMember.count({
      where: { id: { in: unique }, companyId: ctx.companyId, role: 'RECRUITER' },
    });
    if (count !== unique.length) throw ApiError.badRequest('One or more agency recruiters were not found', 'INVALID_RECRUITER');
  }
  await prisma.$transaction([
    prisma.jobRecruiter.deleteMany({ where: { jobId, memberId: { notIn: unique } } }),
    prisma.jobRecruiter.createMany({ data: unique.map((memberId) => ({ jobId, memberId })), skipDuplicates: true }),
  ]);
  return listJobRecruiters(userId, jobId);
}
