// Forgot-password test: request → one-time RESET link (1 hour) → new
// password works, old one doesn't; unknown emails get the same answer;
// max 3 reset emails per account per 15 minutes.
//   node scripts/test-forgot-password.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { issuePasswordToken } from '../src/server/modules/auth/passwordToken.service.js';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ts = Date.now();
const prisma = new PrismaClient();
let passed = 0;

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data };
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  passed++;
  console.log('  ok:', msg);
}

async function main() {
  const email = `fp-cand-${ts}@test.com`;
  const reg = await call('/auth/register/candidate', { method: 'POST', body: { email, password: 'oldpass123', fullName: 'Forgot Test' } });
  assert(reg.status === 201, 'test candidate registered');
  const userId = reg.data.user.id;

  const r1 = await call('/auth/forgot-password', { method: 'POST', body: { email } });
  const r2 = await call('/auth/forgot-password', { method: 'POST', body: { email: `nobody-${ts}@test.com` } });
  assert(r1.status === 200 && r2.status === 200 && r1.json.data.message === r2.json.data.message, 'same answer for known and unknown emails');
  const tokens = await prisma.passwordToken.findMany({ where: { userId, purpose: 'RESET' } });
  assert(tokens.length === 1 && tokens[0].expiresAt.getTime() - Date.now() <= 3600e3 + 5e3, 'one RESET token issued, expiring in ~1 hour');
  const bad = await call('/auth/forgot-password', { method: 'POST', body: { email: 'not-an-email' } });
  assert(bad.status === 400, 'invalid email → 400');

  await call('/auth/forgot-password', { method: 'POST', body: { email } });
  await call('/auth/forgot-password', { method: 'POST', body: { email } });
  await call('/auth/forgot-password', { method: 'POST', body: { email } });
  const count = await prisma.passwordToken.count({ where: { userId, purpose: 'RESET' } });
  assert(count === 3, `at most 3 reset links per 15 minutes (${count})`);

  // The emailed token can't be read back (only its hash is stored), so issue
  // one the same way the endpoint does to walk the rest of the flow.
  const { token } = await issuePasswordToken(userId, { purpose: 'RESET', ttlHours: 1 });
  const info = await call(`/auth/password-token/${token}`);
  assert(info.data?.purpose === 'RESET' && info.data.email === email, 'reset link shows the account (purpose RESET)');
  const set = await call('/auth/set-password', { method: 'POST', body: { token, password: 'newpass123' } });
  assert(set.status === 200 && set.data.token, 'new password set and logged in');
  const oldLogin = await call('/auth/login', { method: 'POST', body: { email, password: 'oldpass123' } });
  const newLogin = await call('/auth/login', { method: 'POST', body: { email, password: 'newpass123' } });
  assert(oldLogin.status === 401 && newLogin.status === 200, 'old password rejected, new one works');
  const reuse = await call('/auth/set-password', { method: 'POST', body: { token, password: 'another123' } });
  assert(reuse.status === 400, 'reset link is single-use');
  const older = await prisma.passwordToken.findFirst({ where: { userId, purpose: 'RESET', usedAt: null, expiresAt: { gt: new Date() } } });
  assert(!older, 'earlier reset links were invalidated');

  console.log(`\nFORGOT-PASSWORD TESTS PASSED ✔  (${passed} checks)`);
}

main()
  .catch((err) => {
    console.error(`\nFORGOT-PASSWORD TEST FAILED after ${passed} checks:`, err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
