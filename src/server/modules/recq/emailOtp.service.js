import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { env, isProduction } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendRecqOtpEmail } from '../notifications/email.service.js';

// Build plan P9 (/recq flow, §5/§17): email OTP. The email is ALWAYS the
// address extracted from the uploaded resume — never one typed by the
// candidate — so the code can only reach the resume's verified owner. Mirrors
// the phone-OTP service (public/otp.service.js):
//   send   → 6-digit code, 5-minute expiry, bcrypt hash only
//   verify → max 5 attempts; caller then issues its own scoped token
// Limits: 3 codes per email / 15 min, 10 per IP / hour, 30s resend cooldown.

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_AFTER_S = 30;
const MAX_ATTEMPTS = 5;
const EMAIL_LIMIT = { count: 3, windowMs: 15 * 60 * 1000 };
const IP_LIMIT = { count: 10, windowMs: 60 * 60 * 1000 };

// The email driver logs instead of sending when Brevo isn't configured; only
// then (and never in production) do we expose the code to the page for dev.
const emailProvider = process.env.EMAIL_PROVIDER || (env.brevoApiKey ? 'brevo' : 'console');
const EMAIL_IS_CONSOLE = emailProvider === 'console';

const tooMany = (message) => new ApiError(429, 'OTP_RATE_LIMITED', message);

export function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

// j***@gmail.com — enough to recognize, not enough to reveal.
export function maskEmail(email) {
  const [user, domain] = normalizeEmail(email).split('@');
  if (!domain) return email;
  const head = user.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}

export async function sendEmailOtp({ email: rawEmail, ip, context = {} }) {
  const email = normalizeEmail(rawEmail);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw ApiError.badRequest("We couldn't find a valid email on your resume. Please upload a resume that lists your email.", 'NO_RESUME_EMAIL');
  }
  const now = Date.now();

  const [byEmail, byIp, latest] = await Promise.all([
    prisma.emailOtp.count({ where: { email, createdAt: { gt: new Date(now - EMAIL_LIMIT.windowMs) } } }),
    ip ? prisma.emailOtp.count({ where: { ip, createdAt: { gt: new Date(now - IP_LIMIT.windowMs) } } }) : 0,
    prisma.emailOtp.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } }),
  ]);
  if (byEmail >= EMAIL_LIMIT.count) throw tooMany('Too many codes requested for this email. Try again in 15 minutes.');
  if (byIp >= IP_LIMIT.count) throw tooMany('Too many codes requested. Try again later.');
  if (latest && now - latest.createdAt.getTime() < RESEND_AFTER_S * 1000) {
    throw tooMany(`Please wait ${RESEND_AFTER_S} seconds before requesting another code.`);
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 8);

  // Only the newest code for an email is valid.
  await prisma.emailOtp.updateMany({
    where: { email, verifiedAt: null, expiresAt: { gt: new Date(now) } },
    data: { expiresAt: new Date(now) },
  });
  await prisma.emailOtp.create({ data: { email, codeHash, ip: ip || null, expiresAt: new Date(now + CODE_TTL_MS) } });

  await sendRecqOtpEmail({ to: email, code, agencyName: context.agencyName, jobTitle: context.jobTitle });

  return {
    emailMasked: maskEmail(email),
    expiresInSeconds: CODE_TTL_MS / 1000,
    resendAfterSeconds: RESEND_AFTER_S,
    ...(EMAIL_IS_CONSOLE && !isProduction ? { devCode: code } : {}),
  };
}

export async function verifyEmailOtp({ email: rawEmail, code }) {
  const email = normalizeEmail(rawEmail);
  const row = await prisma.emailOtp.findFirst({ where: { email, verifiedAt: null }, orderBy: { createdAt: 'desc' } });

  if (!row || row.expiresAt <= new Date()) {
    throw ApiError.badRequest('This code has expired. Please request a new one.', 'OTP_EXPIRED');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw ApiError.badRequest('Too many wrong attempts. Please request a new code.', 'OTP_TOO_MANY_ATTEMPTS');
  }

  const matches = await bcrypt.compare(String(code || ''), row.codeHash);
  if (!matches) {
    const { attempts } = await prisma.emailOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = Math.max(0, MAX_ATTEMPTS - attempts);
    throw ApiError.badRequest(
      left ? `That code isn't right. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Please request a new code.',
      left ? 'OTP_INVALID' : 'OTP_TOO_MANY_ATTEMPTS'
    );
  }

  await prisma.emailOtp.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
  return { email };
}

// Short-lived proof that THIS email (from THIS upload, at THIS agency) was
// verified — required by the apply endpoint. Bound to the upload so a token
// can't be replayed against a different resume/agency.
const RECQ_TOKEN_TTL = '20m';

export function issueRecqToken({ email, agencyId, uploadId }) {
  return jwt.sign({ typ: 'recq', email: normalizeEmail(email), agencyId, uploadId }, env.jwtSecret, { expiresIn: RECQ_TOKEN_TTL });
}

export function assertRecqToken(token, { email, agencyId, uploadId }) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.badRequest('Your email verification has expired. Please verify again.', 'OTP_REQUIRED');
  }
  if (
    payload.typ !== 'recq' ||
    payload.email !== normalizeEmail(email) ||
    payload.agencyId !== agencyId ||
    payload.uploadId !== uploadId
  ) {
    throw ApiError.badRequest('Please verify your email first.', 'OTP_REQUIRED');
  }
  return payload.email;
}
