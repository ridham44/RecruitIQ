import bcrypt from 'bcryptjs';
import { prisma, TX_OPTIONS } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { signToken } from './token.util.js';
import { findUsableToken } from './passwordToken.service.js';

const SALT_ROUNDS = 10;

// function serializeUser(user) {
//   return {
//     id: user.id,
//     email: user.email,
//     role: user.role,
//     company: user.company || undefined,
//     candidate: user.candidate || undefined,
//   };
// }
// Build plan P2: adds `membership` (role + permissions inside the company)
// for owners and recruiters; a recruiter's `company` comes via membership.
function serializeUser(user) {
  const membership = user.membership;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    company: user.company || membership?.company || undefined,
    candidate: user.candidate || undefined,
    membership: membership
      ? { id: membership.id, role: membership.role, permissions: membership.permissions, fullName: membership.fullName }
      : undefined,
  };
}

// Relations every auth response needs (login, /auth/me, set-password).
export const USER_AUTH_INCLUDE = { company: true, candidate: true, membership: { include: { company: true } } };

export async function registerCompany({ email, password, companyName, website, industry, location }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // const user = await prisma.user.create({
  //   data: {
  //     email: normalizedEmail,
  //     passwordHash,
  //     role: ROLES.COMPANY,
  //     company: {
  //       create: { name: companyName, website: website || null, industry: industry || null, location: location || null },
  //     },
  //   },
  //   include: { company: true },
  // });
  // Build plan P2: the owner also gets an OWNER CompanyMember row, in the
  // same transaction as the user + company.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: ROLES.COMPANY,
        company: {
          create: { name: companyName, website: website || null, industry: industry || null, location: location || null },
        },
      },
      include: { company: true },
    });
    await tx.companyMember.create({ data: { companyId: created.company.id, userId: created.id, role: 'OWNER' } });
    return created;
  }, TX_OPTIONS);

  return { user: serializeUser(user), token: signToken(user) };
}

export async function registerCandidate({ email, password, fullName, phone, location }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: ROLES.CANDIDATE,
      candidate: {
        create: { fullName, phone: phone || null, location: location || null },
      },
    },
    include: { candidate: true },
  });

  return { user: serializeUser(user), token: signToken(user) };
}

export async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    // include: { company: true, candidate: true },
    include: USER_AUTH_INCLUDE,
  });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Build plan P1: checked only after the password matches, so a wrong
  // password never reveals whether a company is suspended.
  assertCompanyNotSuspended(user);

  return { user: serializeUser(user), token: signToken(user) };
}

export function assertCompanyNotSuspended(user) {
  // Build plan P2: a deactivated recruiter is treated like a wrong login.
  if (user.role === ROLES.RECRUITER && user.membership && !user.membership.isActive) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  const companyStatus = user.role === ROLES.RECRUITER ? user.membership?.company?.status : user.company?.status;
  // if (user.role === ROLES.COMPANY && user.company?.status === 'SUSPENDED') {
  if ((user.role === ROLES.COMPANY || user.role === ROLES.RECRUITER) && companyStatus === 'SUSPENDED') {
    throw ApiError.forbidden(
      'Your company account has been suspended. Please contact the RecruitIQ administrator.',
      'COMPANY_SUSPENDED'
    );
  }
}

// Build plan P1: lets the set-password page greet the user and show which
// account the link is for before they choose a password.
export async function getPasswordTokenInfo(token) {
  const row = await findUsableToken(token);
  return {
    email: row.user.email,
    role: row.user.role,
    // companyName: row.user.company?.name,
    companyName: row.user.company?.name ?? row.user.membership?.company?.name,
    purpose: row.purpose,
  };
}

// Build plan P1: consumes an invite link, sets the password and logs the
// user straight in. The usedAt IS NULL condition makes the link single-use
// even if it's submitted twice at the same moment.
export async function setPasswordWithToken({ token, password }) {
  const row = await findUsableToken(token);
  if (!row.user.isActive) throw ApiError.forbidden('This account is inactive', 'ACCOUNT_INACTIVE');
  assertCompanyNotSuspended(row.user);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const consumed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) return false;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    return true;
  }, TX_OPTIONS);
  if (!consumed) throw ApiError.badRequest('This link has already been used. Please log in.', 'TOKEN_USED');

  return { user: serializeUser(row.user), token: signToken(row.user) };
}

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    // include: { company: true, candidate: true },
    include: USER_AUTH_INCLUDE,
  });
  if (!user) throw ApiError.notFound('User not found');
  return serializeUser(user);
}
