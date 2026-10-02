// Build plan P1 acceptance test (docs/implementation-plan.html "Done when"):
//   - admin creates a company → owner sets a password → logs in → normal dashboard
//   - a suspended company's owner can't log in, and an already-issued token gets 403
//   - with ALLOW_COMPANY_SELF_REGISTER=false the API returns 403 (checked on a
//     second, temporary server instance so the dev server's flags aren't touched)
// Plus: invite links are single-use, resend works only while pending, admin
// routes reject non-admins, user deactivation blocks login.
//
// Run against the dev server: node scripts/test-p1-platform-admin.mjs
// The temporary admin it creates is deactivated at the end.
import 'dotenv/config';
import { spawn } from 'child_process';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ts = Date.now();
const PASSWORD = 'password123';
const prisma = new PrismaClient();
let passed = 0;

async function call(base, path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/api/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data };
}

async function req(path, opts) {
  const r = await call(BASE, path, opts);
  if (r.status >= 400) {
    console.error(`  FAIL ${opts?.method || 'GET'} ${path} -> ${r.status}`, JSON.stringify(r.json));
    throw new Error(r.json?.message || `HTTP ${r.status}`);
  }
  return r.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  passed++;
  console.log('  ok:', msg);
}

const step = (t) => console.log(`\n== ${t} ==`);
const tokenFrom = (link) => new URL(link).searchParams.get('token');

async function selfRegisterDisabledCheck() {
  const port = 3000 + Math.floor(Math.random() * 900) + 50;
  const code = `import('./src/server/app.js').then(({ createApp }) => createApp().listen(${port}, () => console.log('READY')))`;
  const child = spawn(process.execPath, ['-e', code], {
    env: { ...process.env, ALLOW_COMPANY_SELF_REGISTER: 'false', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('temporary server did not start')), 30000);
      child.stdout.on('data', (d) => d.toString().includes('READY') && (clearTimeout(timer), resolve()));
      child.on('exit', (c) => reject(new Error(`temporary server exited (${c})`)));
    });
    const base = `http://localhost:${port}`;
    const cfg = await call(base, '/config/public');
    assert(cfg.data?.allowCompanySelfRegister === false, 'flag off → /config/public reports allowCompanySelfRegister=false');
    const reg = await call(base, '/auth/register/company', {
      method: 'POST',
      body: { email: `p1-blocked-${ts}@test.com`, password: PASSWORD, companyName: 'Blocked Co' },
    });
    assert(reg.status === 403 && reg.json?.error === 'SELF_REGISTER_DISABLED', `flag off → company self-register is 403 SELF_REGISTER_DISABLED (${reg.status})`);
    const cand = await call(base, '/auth/register/candidate', {
      method: 'POST',
      body: { email: `p1-cand-flagoff-${ts}@test.com`, password: PASSWORD, fullName: 'Flag Off Candidate' },
    });
    assert(cand.status === 201, 'flag off → candidate self-register still works');
  } finally {
    child.kill();
  }
}

let adminId;
async function main() {
  step('0. Setup: temporary Platform Admin');
  const adminEmail = `p1-admin-${ts}@test.com`;
  const admin = await prisma.user.create({
    data: { email: adminEmail, passwordHash: await bcrypt.hash(PASSWORD, 10), role: 'ADMIN' },
  });
  adminId = admin.id;
  const { user: adminUser, token: adminToken } = await req('/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: PASSWORD },
  });
  assert(adminUser.role === 'ADMIN', 'admin logs in with role ADMIN');

  step('1. Self-registration still works while the flag is on (default)');
  const cfg = await req('/config/public');
  assert(cfg.allowCompanySelfRegister === true, 'dev server reports allowCompanySelfRegister=true');
  const selfCo = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p1-self-${ts}@test.com`, password: PASSWORD, companyName: `P1 Self Co ${ts}` },
  });
  assert(selfCo.user.role === 'COMPANY' && selfCo.user.company.status === 'ACTIVE', 'self-registered company is ACTIVE by default');

  step('2. Non-admins are kept out of /admin');
  const asCompany = await call(BASE, '/admin/companies', { token: selfCo.token });
  assert(asCompany.status === 403, `company user gets 403 on /admin/companies (${asCompany.status})`);
  const noToken = await call(BASE, '/admin/companies');
  assert(noToken.status === 401, `no token gets 401 on /admin/companies (${noToken.status})`);

  step('3. Admin creates a company + owner invite');
  const ownerEmail = `p1-owner-${ts}@test.com`;
  const createdCo = await req('/admin/companies', {
    method: 'POST',
    token: adminToken,
    body: { companyName: `P1 Admin Co ${ts}`, ownerEmail, website: 'https://example.com', industry: 'Staffing', size: '11-50', location: 'Pune' },
  });
  const coId = createdCo.company.id;
  assert(createdCo.company.status === 'ACTIVE' && createdCo.company.createdByAdminId === adminId, 'company created ACTIVE, linked to the admin');
  assert(createdCo.company.pendingInvite === true, 'owner invite is pending');
  assert(createdCo.setupLink?.includes('/auth/set-password?token='), 'setup link returned to the admin');
  const dup = await call(BASE, '/admin/companies', { method: 'POST', token: adminToken, body: { companyName: 'Dup', ownerEmail } });
  assert(dup.status === 409, `same owner email again → 409 (${dup.status})`);
  const log = await prisma.emailLog.findFirst({ where: { recipientEmail: ownerEmail, type: 'ACCOUNT_SETUP' } });
  assert(log, `ACCOUNT_SETUP email attempt logged (status ${log?.status})`);

  const list = await req(`/admin/companies?q=${encodeURIComponent(`P1 Admin Co ${ts}`)}`, { token: adminToken });
  assert(list.companies.length === 1 && list.companies[0].owner.email === ownerEmail, 'company list search finds it, with owner email');

  step('4. Owner can\'t log in before setting a password');
  const early = await call(BASE, '/auth/login', { method: 'POST', body: { email: ownerEmail, password: PASSWORD } });
  assert(early.status === 401, `login before setup fails (${early.status})`);

  step('5. Resend invite: old link stops working, new one works');
  const resent = await req(`/admin/companies/${coId}/resend-invite`, { method: 'POST', token: adminToken });
  const oldToken = tokenFrom(createdCo.setupLink);
  const newToken = tokenFrom(resent.setupLink);
  assert(newToken && newToken !== oldToken, 'resend issued a different link');
  const oldInfo = await call(BASE, `/auth/password-token/${oldToken}`);
  assert(oldInfo.status === 400 && oldInfo.json?.error === 'TOKEN_EXPIRED', `old link is now expired (${oldInfo.json?.error})`);
  const info = await req(`/auth/password-token/${newToken}`);
  assert(info.email === ownerEmail && info.companyName === `P1 Admin Co ${ts}`, 'new link shows the owner email + company');

  step('6. Owner sets a password and lands on the normal company dashboard');
  const weak = await call(BASE, '/auth/set-password', { method: 'POST', body: { token: newToken, password: 'short' } });
  assert(weak.status === 400, 'weak password rejected');
  const setPw = await req('/auth/set-password', { method: 'POST', body: { token: newToken, password: PASSWORD } });
  assert(setPw.user.role === 'COMPANY' && setPw.token, 'set-password logs the owner in');
  const reuse = await call(BASE, '/auth/set-password', { method: 'POST', body: { token: newToken, password: 'another123' } });
  assert(reuse.status === 400 && reuse.json?.error === 'TOKEN_USED', `link is single-use (${reuse.json?.error})`);
  const { token: ownerToken } = await req('/auth/login', { method: 'POST', body: { email: ownerEmail, password: PASSWORD } });
  const overview = await req('/companies/dashboard-overview', { token: ownerToken });
  assert(overview && typeof overview === 'object', 'owner opens the company dashboard overview');
  const { job } = await req('/jobs', {
    method: 'POST',
    token: ownerToken,
    body: { title: 'P1 Test Role', description: 'Testing that an admin-created company can post jobs normally.', status: 'DRAFT' },
  });
  assert(job?.id, 'admin-created company can create a job');
  const detail = await req(`/admin/companies/${coId}`, { token: adminToken });
  assert(detail.company.pendingInvite === false && detail.company.jobCount === 1, 'admin sees invite no longer pending and 1 job');
  const noResend = await call(BASE, `/admin/companies/${coId}/resend-invite`, { method: 'POST', token: adminToken });
  assert(noResend.status === 400 && noResend.json?.error === 'INVITE_NOT_PENDING', 'resend refused once the password is set');

  step('7. Admin edits the company');
  const edited = await req(`/admin/companies/${coId}`, { method: 'PATCH', token: adminToken, body: { location: 'Mumbai', industry: '' } });
  assert(edited.company.location === 'Mumbai' && edited.company.industry === null && edited.company.website === 'https://example.com', 'edit updates only the given fields (blank clears)');

  step('8. Suspension blocks login AND already-issued tokens');
  await req(`/admin/companies/${coId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'SUSPENDED' } });
  const oldTokenUse = await call(BASE, '/jobs/company/mine', { token: ownerToken });
  const meSuspended = await call(BASE, '/auth/me', { token: ownerToken });
  assert(meSuspended.status === 403 && meSuspended.json?.error === 'COMPANY_SUSPENDED', `existing token → 403 COMPANY_SUSPENDED (${meSuspended.status})`);
  assert(oldTokenUse.status === 403 || oldTokenUse.status === 404, `existing token can't reach company APIs (${oldTokenUse.status})`);
  const loginSuspended = await call(BASE, '/auth/login', { method: 'POST', body: { email: ownerEmail, password: PASSWORD } });
  assert(loginSuspended.status === 403 && loginSuspended.json?.error === 'COMPANY_SUSPENDED', `login → 403 COMPANY_SUSPENDED (${loginSuspended.status})`);
  const wrongPw = await call(BASE, '/auth/login', { method: 'POST', body: { email: ownerEmail, password: 'wrong-pass1' } });
  assert(wrongPw.status === 401, 'wrong password on a suspended company still says 401 (status not leaked)');
  const otherCo = await call(BASE, '/auth/me', { token: selfCo.token });
  assert(otherCo.status === 200, 'other companies are unaffected');

  await req(`/admin/companies/${coId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'ACTIVE' } });
  const meAgain = await call(BASE, '/auth/me', { token: ownerToken });
  assert(meAgain.status === 200, 'after re-activation the same token works again');

  step('9. User deactivation');
  const { users } = await req(`/admin/users?q=${encodeURIComponent(ownerEmail)}`, { token: adminToken });
  const ownerUser = users.find((u) => u.email === ownerEmail);
  assert(ownerUser?.role === 'COMPANY' && ownerUser.company?.id === coId, 'users list finds the owner with company');
  await req(`/admin/users/${ownerUser.id}/status`, { method: 'PATCH', token: adminToken, body: { isActive: false } });
  const meInactive = await call(BASE, '/auth/me', { token: ownerToken });
  assert(meInactive.status === 401 && meInactive.json?.error === 'ACCOUNT_INACTIVE', `deactivated user's token → 401 (${meInactive.status})`);
  const loginInactive = await call(BASE, '/auth/login', { method: 'POST', body: { email: ownerEmail, password: PASSWORD } });
  assert(loginInactive.status === 401, 'deactivated user cannot log in');
  await req(`/admin/users/${ownerUser.id}/status`, { method: 'PATCH', token: adminToken, body: { isActive: true } });
  const selfChange = await call(BASE, `/admin/users/${adminId}/status`, { method: 'PATCH', token: adminToken, body: { isActive: false } });
  assert(selfChange.status === 400, 'admin cannot deactivate themselves');

  step('10. Candidates are unaffected');
  const cand = await req('/auth/register/candidate', {
    method: 'POST',
    body: { email: `p1-cand-${ts}@test.com`, password: PASSWORD, fullName: 'P1 Candidate' },
  });
  const candMe = await req('/auth/me', { token: cand.token });
  assert(candMe.user.role === 'CANDIDATE', 'candidate registers and /auth/me works');
  const candAdmin = await call(BASE, '/admin/users', { token: cand.token });
  assert(candAdmin.status === 403, 'candidate gets 403 on /admin');

  step('11. ALLOW_COMPANY_SELF_REGISTER=false (temporary server)');
  await selfRegisterDisabledCheck();

  console.log(`\nPHASE 1 TESTS PASSED ✔  (${passed} checks)`);
}

main()
  .catch((err) => {
    console.error(`\nPHASE 1 TEST FAILED after ${passed} passing checks:`, err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Never leave a usable test admin behind.
    if (adminId) await prisma.user.update({ where: { id: adminId }, data: { isActive: false } }).catch(() => {});
    await prisma.$disconnect();
  });
