// Build plan P2 acceptance test (docs/implementation-plan.html "Done when"):
//   - a recruiter assigned to job X can review X's applicants and gets 403 on job Y
//   - a deactivated recruiter can't log in
// Plus: permissions gate actions, job scoping on lists/dashboard, owner is
// unrestricted, no self-edit / owner-edit, cross-company isolation,
// suspension covers recruiters, invite resend, admin users list.
//
// Run against the dev server: node scripts/test-p2-recruiters.mjs
// The temporary admin it creates is deactivated at the end.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ts = Date.now();
const PASSWORD = 'password123';
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

async function req(path, opts) {
  const r = await call(path, opts);
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
const job = (title) => ({ title, description: `${title} — P2 recruiter scoping test job.`, status: 'OPEN' });

async function acceptInvite(link) {
  const r = await req('/auth/set-password', { method: 'POST', body: { token: tokenFrom(link), password: PASSWORD } });
  return r.token;
}

let adminId;
async function main() {
  step('0. Setup: owner A with jobs X and Y, owner B, temporary admin');
  const ownerA = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p2-owner-a-${ts}@test.com`, password: PASSWORD, companyName: `P2 Company A ${ts}` },
  });
  const tA = ownerA.token;
  const { job: jobX } = await req('/jobs', { method: 'POST', token: tA, body: job('P2 Job X') });
  const { job: jobY } = await req('/jobs', { method: 'POST', token: tA, body: job('P2 Job Y') });
  const ownerB = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p2-owner-b-${ts}@test.com`, password: PASSWORD, companyName: `P2 Company B ${ts}` },
  });
  const admin = await prisma.user.create({
    data: { email: `p2-admin-${ts}@test.com`, passwordHash: await bcrypt.hash(PASSWORD, 10), role: 'ADMIN' },
  });
  adminId = admin.id;
  const { token: tAdmin } = await req('/auth/login', { method: 'POST', body: { email: admin.email, password: PASSWORD } });

  const { members: initial } = await req('/recruiters', { token: tA });
  assert(initial.length === 1 && initial[0].role === 'OWNER', 'new company has exactly its OWNER member');
  const meA = await req('/auth/me', { token: tA });
  assert(meA.user.membership?.role === 'OWNER', '/auth/me returns the owner membership');

  step('1. Owner invites recruiter R1 (Review candidates, job X)');
  const r1Email = `p2-rec1-${ts}@test.com`;
  const inv = await req('/recruiters', {
    method: 'POST',
    token: tA,
    body: { email: r1Email, fullName: 'Riya Recruiter', permissions: ['REVIEW_CANDIDATES'], jobIds: [jobX.id] },
  });
  const r1Id = inv.recruiter.id;
  assert(inv.recruiter.pendingInvite && inv.recruiter.jobs.length === 1, 'recruiter created with pending invite and job X');
  const badPerm = await call('/recruiters', { method: 'POST', token: tA, body: { email: `x-${ts}@test.com`, fullName: 'X', permissions: ['GOD_MODE'] } });
  assert(badPerm.status === 400, 'unknown permission key rejected');
  const otherCoJob = await call('/recruiters', {
    method: 'POST',
    token: ownerB.token,
    body: { email: `x2-${ts}@test.com`, fullName: 'Xavier Test', jobIds: [jobX.id] },
  });
  assert(otherCoJob.status === 400, "company B can't assign company A's job");
  const info = await req(`/auth/password-token/${tokenFrom(inv.setupLink)}`);
  assert(info.role === 'RECRUITER' && info.companyName === `P2 Company A ${ts}`, 'invite link shows recruiter + company name');
  const tR1 = await acceptInvite(inv.setupLink);
  const meR1 = await req('/auth/me', { token: tR1 });
  assert(meR1.user.role === 'RECRUITER' && meR1.user.company?.name === `P2 Company A ${ts}`, 'R1 logs in as RECRUITER of company A');
  assert(meR1.user.membership.permissions.join() === 'REVIEW_CANDIDATES', '/auth/me returns R1 permissions');

  step('2. Job scoping');
  const { jobs: r1Jobs } = await req('/jobs/company/mine', { token: tR1 });
  assert(r1Jobs.length === 1 && r1Jobs[0].id === jobX.id, 'R1 job list shows only job X');
  const { jobs: aJobs } = await req('/jobs/company/mine', { token: tA });
  assert(aJobs.length === 2, 'owner still sees both jobs');
  const appsX = await call(`/applications/job/${jobX.id}`, { token: tR1 });
  assert(appsX.status === 200, 'R1 can review job X applicants');
  const appsY = await call(`/applications/job/${jobY.id}`, { token: tR1 });
  assert(appsY.status === 403 && appsY.json?.error === 'JOB_NOT_ASSIGNED', `R1 gets 403 JOB_NOT_ASSIGNED on job Y (${appsY.status})`);
  const rankedY = await call(`/screening/job/${jobY.id}/ranked`, { token: tR1 });
  assert(rankedY.status === 403, 'R1 cannot see job Y screening');
  const { overview: dashR1 } = await req('/companies/dashboard-overview', { token: tR1 });
  const { overview: dashA } = await req('/companies/dashboard-overview', { token: tA });
  assert(dashR1.totalJobsCount === 1 && dashA.totalJobsCount === 2, `dashboard counts are scoped (R1 ${dashR1.totalJobsCount}, owner ${dashA.totalJobsCount})`);

  step('3. Permissions gate actions');
  const createNoPerm = await call('/jobs', { method: 'POST', token: tR1, body: job('Should fail') });
  assert(createNoPerm.status === 403 && createNoPerm.json?.error === 'PERMISSION_DENIED', 'R1 without MANAGE_JOBS cannot create a job');
  const editJob = await call(`/jobs/${jobX.id}`, { method: 'PATCH', token: tR1, body: { title: 'Hacked' } });
  assert(editJob.status === 403, 'R1 without MANAGE_JOBS cannot edit job X');
  const cfgGet = await call(`/interviews/config/${jobX.id}`, { token: tR1 });
  assert(cfgGet.status === 200, 'R1 can view the interview config for job X');
  const cfgPatch = await call(`/interviews/config/${jobX.id}`, { method: 'PATCH', token: tR1, body: { aiName: 'Nope' } });
  assert(cfgPatch.status === 403 && cfgPatch.json?.error === 'PERMISSION_DENIED', 'R1 without CONFIGURE_INTERVIEWS cannot change it');
  const slots = await call(`/scheduling/jobs/${jobX.id}/slots/generate`, {
    method: 'POST',
    token: tR1,
    body: { rangeStart: new Date().toISOString(), rangeEnd: new Date(Date.now() + 3600e3).toISOString(), durationMinutes: 30 },
  });
  assert(slots.status === 403, 'R1 without CONFIGURE_INTERVIEWS cannot create slots');
  const profile = await call('/companies/me', { method: 'PATCH', token: tR1, body: { name: 'Hacked Co' } });
  assert(profile.status === 403, 'R1 cannot edit the company profile');
  const recList = await call('/recruiters', { token: tR1 });
  assert(recList.status === 403, 'R1 without MANAGE_RECRUITERS cannot list recruiters');
  const stillIn = await call('/auth/me', { token: tR1 });
  assert(stillIn.status === 200, 'permission errors do not invalidate the session');

  step('4. Owner grants MANAGE_JOBS; R1 creates job Z');
  await req(`/recruiters/${r1Id}/permissions`, { method: 'PUT', token: tA, body: { permissions: ['REVIEW_CANDIDATES', 'MANAGE_JOBS'] } });
  const { job: jobZ } = await req('/jobs', { method: 'POST', token: tR1, body: job('P2 Job Z') });
  const { jobs: r1Jobs2 } = await req('/jobs/company/mine', { token: tR1 });
  assert(r1Jobs2.map((j) => j.id).sort().join() === [jobX.id, jobZ.id].sort().join(), 'R1 sees X and the job they created (Z)');
  const { recruiters: zRecs } = await req(`/recruiters/job/${jobZ.id}`, { token: tA });
  assert(zRecs.length === 1 && zRecs[0].id === r1Id, 'R1 is auto-assigned to the job they created');
  const { jobs: aJobs2 } = await req('/jobs/company/mine', { token: tA });
  assert(aJobs2.length === 3, 'owner sees all three jobs');

  step('5. Assignments from both sides');
  await req(`/recruiters/job/${jobY.id}`, { method: 'PUT', token: tA, body: { memberIds: [r1Id] } });
  assert((await call(`/applications/job/${jobY.id}`, { token: tR1 })).status === 200, 'after assigning Y from the job page, R1 can review Y');
  await req(`/recruiters/${r1Id}/jobs`, { method: 'PUT', token: tA, body: { jobIds: [] } });
  const { jobs: r1Jobs3 } = await req('/jobs/company/mine', { token: tR1 });
  assert(r1Jobs3.length === 1 && r1Jobs3[0].id === jobZ.id, 'after clearing assignments R1 still sees the job they created');
  assert((await call(`/applications/job/${jobX.id}`, { token: tR1 })).status === 403, 'and loses access to X');

  step('6. No editing the owner or yourself');
  await req(`/recruiters/${r1Id}/permissions`, { method: 'PUT', token: tA, body: { permissions: ['MANAGE_RECRUITERS'] } });
  const { members } = await req('/recruiters', { token: tR1 });
  const ownerMember = members.find((m) => m.role === 'OWNER');
  const editOwner = await call(`/recruiters/${ownerMember.id}/status`, { method: 'PATCH', token: tR1, body: { isActive: false } });
  assert(editOwner.status === 400, 'recruiter cannot deactivate the owner');
  const editSelf = await call(`/recruiters/${r1Id}/permissions`, { method: 'PUT', token: tR1, body: { permissions: ['MANAGE_JOBS', 'MANAGE_RECRUITERS', 'REVIEW_CANDIDATES', 'CONFIGURE_INTERVIEWS'] } });
  assert(editSelf.status === 400, 'recruiter cannot change their own permissions');

  step('7. Cross-company isolation');
  const crossStatus = await call(`/recruiters/${r1Id}/status`, { method: 'PATCH', token: ownerB.token, body: { isActive: false } });
  assert(crossStatus.status === 404, "company B can't touch company A's recruiter");
  const crossJob = await call(`/recruiters/job/${jobX.id}`, { token: ownerB.token });
  assert(crossJob.status === 404, "company B can't see company A's job recruiters");
  const { members: bMembers } = await req('/recruiters', { token: ownerB.token });
  assert(bMembers.length === 1, 'company B only sees its own owner');

  step('8. Resend invite for a pending recruiter');
  const inv2 = await req('/recruiters', { method: 'POST', token: tA, body: { email: `p2-rec2-${ts}@test.com`, fullName: 'Second Recruiter' } });
  const resent = await req(`/recruiters/${inv2.recruiter.id}/resend-invite`, { method: 'POST', token: tA });
  const oldInfo = await call(`/auth/password-token/${tokenFrom(inv2.setupLink)}`);
  assert(oldInfo.json?.error === 'TOKEN_EXPIRED', 'old recruiter link expired after resend');
  await acceptInvite(resent.setupLink);
  const again = await call(`/recruiters/${inv2.recruiter.id}/resend-invite`, { method: 'POST', token: tA });
  assert(again.status === 400, 'resend refused once the recruiter set a password');

  step('9. Deactivation');
  await req(`/recruiters/${r1Id}/status`, { method: 'PATCH', token: tA, body: { isActive: false } });
  const meOff = await call('/auth/me', { token: tR1 });
  assert(meOff.status === 401, `deactivated recruiter token → 401 (${meOff.status})`);
  const loginOff = await call('/auth/login', { method: 'POST', body: { email: r1Email, password: PASSWORD } });
  assert(loginOff.status === 401, 'deactivated recruiter cannot log in');
  const { jobs: stillThere } = await req('/jobs/company/mine', { token: tA });
  assert(stillThere.some((j) => j.id === jobZ.id), "the recruiter's job stays with the company");
  await req(`/recruiters/${r1Id}/status`, { method: 'PATCH', token: tA, body: { isActive: true } });
  const { token: tR1b } = await req('/auth/login', { method: 'POST', body: { email: r1Email, password: PASSWORD } });
  assert(tR1b, 'reactivated recruiter can log in again');

  step('10. Suspension covers recruiters');
  const companyAId = meA.user.company.id;
  await req(`/admin/companies/${companyAId}/status`, { method: 'PATCH', token: tAdmin, body: { status: 'SUSPENDED' } });
  const meSusp = await call('/auth/me', { token: tR1b });
  assert(meSusp.status === 403 && meSusp.json?.error === 'COMPANY_SUSPENDED', 'recruiter token → 403 COMPANY_SUSPENDED');
  const loginSusp = await call('/auth/login', { method: 'POST', body: { email: r1Email, password: PASSWORD } });
  assert(loginSusp.status === 403, 'recruiter login blocked while suspended');
  await req(`/admin/companies/${companyAId}/status`, { method: 'PATCH', token: tAdmin, body: { status: 'ACTIVE' } });
  assert((await call('/auth/me', { token: tR1b })).status === 200, 'recruiter works again after re-activation');

  step('11. Admin users list');
  const { users } = await req(`/admin/users?q=${encodeURIComponent(r1Email)}`, { token: tAdmin });
  assert(users[0]?.role === 'RECRUITER' && users[0].company?.id === companyAId && users[0].memberName === 'Riya Recruiter', 'admin sees the recruiter with company and name');

  console.log(`\nPHASE 2 TESTS PASSED ✔  (${passed} checks)`);
}

main()
  .catch((err) => {
    console.error(`\nPHASE 2 TEST FAILED after ${passed} passing checks:`, err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (adminId) await prisma.user.update({ where: { id: adminId }, data: { isActive: false } }).catch(() => {});
    await prisma.$disconnect();
  });
