import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { env, isProduction } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { normalizePhone } from '../../utils/phone.js';
import { smsDriver } from '../notifications/sms/index.js';

// Build plan P4 (§7): phone OTP for the careers portal.
//   send   → 6-digit code, 5-minute expiry, bcrypt hash only
//   verify → max 5 attempts, returns a 15-minute otpToken (JWT holding the
//            phone) that POST /public/applications requires
// Limits: 3 codes per phone per 15 minutes, 10 per IP per hour.

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_AFTER_S = 30;
const MAX_ATTEMPTS = 5;
const PHONE_LIMIT = { count: 3, windowMs: 15 * 60 * 1000 };
const IP_LIMIT = { count: 10, windowMs: 60 * 60 * 1000 };
const OTP_TOKEN_TTL = '15m';

const tooMany = (message) => new ApiError(429, 'OTP_RATE_LIMITED', message);

export function requirePhone(input) {
  const phone = normalizePhone(input);
  if (!phone) throw ApiError.badRequest('Enter a valid phone number', 'INVALID_PHONE');
  return phone;
}

export async function sendOtp({ phone: rawPhone, ip }) {
  const phone = requirePhone(rawPhone);
  const now = Date.now();

  const [byPhone, byIp, latest] = await Promise.all([
    prisma.phoneOtp.count({ where: { phone, createdAt: { gt: new Date(now - PHONE_LIMIT.windowMs) } } }),
    ip ? prisma.phoneOtp.count({ where: { ip, createdAt: { gt: new Date(now - IP_LIMIT.windowMs) } } }) : 0,
    prisma.phoneOtp.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } }),
  ]);
  if (byPhone >= PHONE_LIMIT.count) throw tooMany('Too many codes requested for this number. Try again in 15 minutes.');
  if (byIp >= IP_LIMIT.count) throw tooMany('Too many codes requested. Try again later.');
  if (latest && now - latest.createdAt.getTime() < RESEND_AFTER_S * 1000) {
    throw tooMany(`Please wait ${RESEND_AFTER_S} seconds before requesting another code.`);
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 8);

  // Only the newest code for a phone is valid.
  await prisma.phoneOtp.updateMany({
    where: { phone, verifiedAt: null, expiresAt: { gt: new Date(now) } },
    data: { expiresAt: new Date(now) },
  });
  await prisma.phoneOtp.create({ data: { phone, codeHash, ip: ip || null, expiresAt: new Date(now + CODE_TTL_MS) } });

  try {
    await smsDriver.send({ to: phone, body: `Your RecruitIQ verification code is ${code}. It expires in 5 minutes.` });
  } catch (err) {
    console.error('[otp] SMS send failed:', err.message);
    throw new ApiError(502, 'SMS_FAILED', "We couldn't send the code. Please check the number and try again.");
  }

  return {
    phone,
    expiresInSeconds: CODE_TTL_MS / 1000,
    resendAfterSeconds: RESEND_AFTER_S,
    // Development convenience only: with the console driver nothing is
    // actually sent, so the page can show the code. Never in production.
    ...(smsDriver.name === 'console' && !isProduction ? { devCode: code } : {}),
  };
}

export async function verifyOtp({ phone: rawPhone, code }) {
  const phone = requirePhone(rawPhone);
  const row = await prisma.phoneOtp.findFirst({ where: { phone, verifiedAt: null }, orderBy: { createdAt: 'desc' } });

  if (!row || row.expiresAt <= new Date()) {
    throw ApiError.badRequest('This code has expired. Please request a new one.', 'OTP_EXPIRED');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw ApiError.badRequest('Too many wrong attempts. Please request a new code.', 'OTP_TOO_MANY_ATTEMPTS');
  }

  const matches = await bcrypt.compare(code, row.codeHash);
  if (!matches) {
    const { attempts } = await prisma.phoneOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = Math.max(0, MAX_ATTEMPTS - attempts);
    throw ApiError.badRequest(
      left ? `That code isn't right. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Please request a new code.',
      left ? 'OTP_INVALID' : 'OTP_TOO_MANY_ATTEMPTS'
    );
  }

  await prisma.phoneOtp.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
  const otpToken = jwt.sign({ typ: 'otp', phone }, env.jwtSecret, { expiresIn: OTP_TOKEN_TTL });
  return { phone, otpToken };
}

// Throws unless `token` is a valid otpToken for exactly this phone.
export function assertOtpToken(token, rawPhone) {
  const phone = requirePhone(rawPhone);
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.badRequest('Your phone verification has expired. Please verify again.', 'OTP_REQUIRED');
  }
  if (payload.typ !== 'otp' || payload.phone !== phone) {
    throw ApiError.badRequest('Please verify this phone number first.', 'OTP_REQUIRED');
  }
  return phone;
}
