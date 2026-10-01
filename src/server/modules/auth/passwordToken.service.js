import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

// Build plan P1: single-use "set your password" links. The raw token only
// ever exists in the link itself — the database keeps its SHA-256 hash, so a
// leaked DB row can't be turned back into a working link.

const INVITE_TTL_HOURS = 72;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setPasswordLink(token) {
  return `${env.clientUrl.split(',')[0].trim()}/auth/set-password?token=${token}`;
}

// Issues a new token and expires any earlier unused ones for the same
// user/purpose, so only the most recent link works.
export async function issuePasswordToken(userId, { purpose = 'INVITE', ttlHours = INVITE_TTL_HOURS, tx = prisma } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();

  await tx.passwordToken.updateMany({
    where: { userId, purpose, usedAt: null, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });
  await tx.passwordToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + ttlHours * 3600 * 1000),
    },
  });

  return { token, link: setPasswordLink(token) };
}

// Returns the token row (with its user) if it's unused and unexpired.
export async function findUsableToken(token) {
  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('This link is invalid', 'INVALID_TOKEN');
  }
  const row = await prisma.passwordToken.findUnique({
    where: { tokenHash: hashToken(token) },
    // include: { user: { include: { company: true, candidate: true } } },
    // include: { user: { include: { company: true, candidate: true, membership: { include: { company: true } } } } },
    // Build plan P8: + hiringPerson (client HR invites)
    include: {
      user: {
        include: {
          company: true,
          candidate: true,
          membership: { include: { company: true } },
          // hiringPerson: { include: { department: { include: { clientCompany: { include: { company: true } } } } } },
          hiringPerson: { include: { department: true, clientCompany: { include: { company: true } } } },
        },
      },
    },
  });
  if (!row) throw ApiError.badRequest('This link is invalid', 'INVALID_TOKEN');
  if (row.usedAt) throw ApiError.badRequest('This link has already been used. Please log in.', 'TOKEN_USED');
  if (row.expiresAt <= new Date()) {
    throw ApiError.badRequest('This link has expired. Ask your administrator for a new one.', 'TOKEN_EXPIRED');
  }
  return row;
}

// True while an admin-created account's owner hasn't set their password
// yet (no INVITE token has ever been used).
export async function hasPendingInvite(userId) {
  const used = await prisma.passwordToken.count({ where: { userId, purpose: 'INVITE', usedAt: { not: null } } });
  if (used > 0) return false;
  const issued = await prisma.passwordToken.count({ where: { userId, purpose: 'INVITE' } });
  return issued > 0;
}
