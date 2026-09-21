import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { signToken } from './token.util.js';

const SALT_ROUNDS = 10;

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    company: user.company || undefined,
    candidate: user.candidate || undefined,
  };
}

export async function registerCompany({ email, password, companyName, website, industry, location }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: ROLES.COMPANY,
      company: {
        create: { name: companyName, website: website || null, industry: industry || null, location: location || null },
      },
    },
    include: { company: true },
  });

  return { user: serializeUser(user), token: signToken(user) };
}

export async function registerCandidate({ email, password, fullName, phone, location }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
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
  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true, candidate: true },
  });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return { user: serializeUser(user), token: signToken(user) };
}

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true, candidate: true },
  });
  if (!user) throw ApiError.notFound('User not found');
  return serializeUser(user);
}
