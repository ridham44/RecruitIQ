import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, TX_OPTIONS } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { issuePasswordToken, hasPendingInvite } from '../auth/passwordToken.service.js';
import { sendAccountSetupEmail } from '../notifications/email.service.js';

// Build plan P1 — Platform Admin: onboard and manage Recruitment Companies.
// The existing Company table IS the recruitment company; an admin-created
// company is identical to a self-registered one except for createdByAdminId
// and how the owner gets their password (an emailed invite link).

const blankToNull = (v) => (v === undefined ? undefined : v?.trim?.() ? v.trim() : null);

function serializeCompany(company, extra = {}) {
  const { user, _count, ...rest } = company;
  return {
    ...rest,
    owner: user ? { id: user.id, email: user.email, isActive: user.isActive, createdAt: user.createdAt } : null,
    jobCount: _count?.jobs ?? 0,
    ...extra,
  };
}

async function applicationCountsByCompany(companyIds) {
  if (!companyIds.length) return {};
  const jobs = await prisma.job.findMany({
    where: { companyId: { in: companyIds } },
    select: { companyId: true, _count: { select: { applications: true } } },
  });
  const counts = {};
  for (const job of jobs) counts[job.companyId] = (counts[job.companyId] || 0) + job._count.applications;
  return counts;
}

export async function listCompanies({ q, status } = {}) {
  const search = q?.trim();
  const companies = await prisma.company.findMany({
    where: {
      ...(status === 'ACTIVE' || status === 'SUSPENDED' ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: { user: true, _count: { select: { jobs: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const appCounts = await applicationCountsByCompany(companies.map((c) => c.id));
  return companies.map((c) => serializeCompany(c, { applicationCount: appCounts[c.id] || 0 }));
}

async function loadCompany(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { user: true, _count: { select: { jobs: true } } },
  });
  if (!company) throw ApiError.notFound('Agency not found');
  return company;
}

export async function getCompany(companyId) {
  const company = await loadCompany(companyId);
  const [appCounts, pendingInvite, openJobs] = await Promise.all([
    applicationCountsByCompany([company.id]),
    hasPendingInvite(company.userId),
    prisma.job.count({ where: { companyId: company.id, status: 'OPEN' } }),
  ]);
  return serializeCompany(company, {
    applicationCount: appCounts[company.id] || 0,
    openJobCount: openJobs,
    pendingInvite,
  });
}

// Company + owner user in one transaction, then an invite link. The owner
// gets a random password hash nobody knows, so the account can't be used
// until they set their own password from the link.
export async function createCompany(adminUserId, data) {
  const ownerEmail = data.ownerEmail.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  const { company, link } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: ownerEmail,
        passwordHash: unusablePasswordHash,
        role: ROLES.COMPANY,
        company: {
          create: {
            name: data.companyName.trim(),
            website: blankToNull(data.website) ?? null,
            industry: blankToNull(data.industry) ?? null,
            size: blankToNull(data.size) ?? null,
            location: blankToNull(data.location) ?? null,
            description: blankToNull(data.description) ?? null,
            createdByAdminId: adminUserId,
          },
        },
      },
      include: { company: true },
    });
    // Build plan P2: owner membership.
    await tx.companyMember.create({ data: { companyId: user.company.id, userId: user.id, role: 'OWNER' } });
    const invite = await issuePasswordToken(user.id, { tx });
    return { company: user.company, link: invite.link };
  }, TX_OPTIONS);

  // Never throws — a failed send is logged in EmailLog, and the admin still
  // gets the link below to share by hand.
  await sendAccountSetupEmail({ to: ownerEmail, companyName: company.name, link });

  return { company: await getCompany(company.id), setupLink: link };
}

export async function updateCompany(companyId, data) {
  await loadCompany(companyId);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: data.companyName?.trim() || undefined,
      website: blankToNull(data.website),
      industry: blankToNull(data.industry),
      size: blankToNull(data.size),
      location: blankToNull(data.location),
      description: blankToNull(data.description),
    },
  });
  return getCompany(companyId);
}

export async function setCompanyStatus(companyId, status) {
  await loadCompany(companyId);
  await prisma.company.update({ where: { id: companyId }, data: { status } });
  return getCompany(companyId);
}

// Only for admin-onboarded owners who haven't set a password yet — it must
// not become a way to take over an account that's already in use.
export async function resendInvite(companyId) {
  const company = await loadCompany(companyId);
  if (!company.createdByAdminId || !(await hasPendingInvite(company.userId))) {
    throw ApiError.badRequest('The agency owner has already set a password for this account', 'INVITE_NOT_PENDING');
  }
  const { link } = await issuePasswordToken(company.userId);
  await sendAccountSetupEmail({ to: company.user.email, companyName: company.name, link });
  return { setupLink: link };
}

// Build plan P2: recruiters reach their company through membership.
const USER_LIST_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  company: { select: { id: true, name: true, status: true } },
  candidate: { select: { id: true, fullName: true } },
  membership: { select: { fullName: true, company: { select: { id: true, name: true, status: true } } } },
};

function serializeListUser({ membership, ...user }) {
  return {
    ...user,
    company: user.company || membership?.company || null,
    memberName: membership?.fullName || null,
  };
}

export async function listUsers({ q, role, status } = {}) {
  const search = q?.trim();
  const users = await prisma.user.findMany({
    where: {
      ...(role && Object.values(ROLES).includes(role) ? { role } : {}),
      ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { company: { name: { contains: search, mode: 'insensitive' } } },
              { candidate: { fullName: { contains: search, mode: 'insensitive' } } },
              { membership: { fullName: { contains: search, mode: 'insensitive' } } },
              { membership: { company: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    // select: { id, email, role, isActive, createdAt, company, candidate },
    select: USER_LIST_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return users.map(serializeListUser);
}

export async function setUserStatus(adminUserId, userId, isActive) {
  if (adminUserId === userId) {
    throw ApiError.badRequest("You can't deactivate your own account", 'CANNOT_CHANGE_SELF');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    // select: { id, email, role, isActive, createdAt, company, candidate },
    select: USER_LIST_SELECT,
  });
  return serializeListUser(updated);
}
