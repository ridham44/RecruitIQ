// Build plan P8 acceptance test (docs/implementation-plan.html "Done when"):
//   - an HR person gets invited, logs in, sees exactly their submissions and
//     opens the CV and evaluation
//   - HR for another department gets 404 on those submissions
// Plus: auto-invite on the first submission, Viewed tracking, no access to
// company/candidate APIs, deactivation, suspension, email conflicts, flag off.
//
// Starts its own API with FEATURE_CLIENT_PORTAL=true (port 3095). To stay
// fast and cheap it marks one application INTERVIEW_COMPLETED directly
// instead of running a full AI interview (P7's test covers that path).
//   node scripts/test-p8-client-portal.mjs
import 'dotenv/config';
import { spawn } from 'child_process';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { buildDocx, reactResumeLines, DOCX_MIME } from './lib/testDocx.mjs';

const DEV_BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const PORT = Number(process.env.P8_TEST_PORT || 3095);
const BASE = `http://localhost:${PORT}`;
const ts = Date.now();
const PASSWORD = 'password123';
const prisma = new PrismaClient();
let passed = 0;
let adminId;

async function call(path, { method = 'GET', body, token, form, base = BASE, raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/api/v1${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  if (raw) return res;
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
const tokenOf = (link) => new URL(link).searchParams.get('token');

async function startServer() {
  const code = `import('./src/server/app.js').then(({ createApp }) => createApp().listen(${PORT}, () => console.log('READY')))`;
  const child = spawn(process.execPath, ['-e', code], {
    env: { ...process.env, FEATURE_CLIENT_PORTAL: 'true', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.env.P8_VERBOSE && process.stderr.write(d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test server did not start')), 30000);
    child.stdout.on('data', (d) => d.toString().includes('READY') && (clearTimeout(timer), resolve()));
    child.on('exit', (c) => reject(new Error(`test server exited (${c})`)));
  });
  return child;
}

async function completedApplication(owner, jobId, label) {
  const email = `p8-${label}-${ts}@test.com`;
  const cand = await req('/auth/register/candidate', { method: 'POST', body: { email, password: PASSWORD, fullName: `Portal ${label}` } });
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines(`P8 ${label}`, email, '+919812300008'))], { type: DOCX_MIME }), 'cv.docx');
  const { resume } = await req('/resumes', { method: 'POST', token: cand.token, form });
  const { application } = await req('/applications', { method: 'POST', token: cand.token, body: { jobId, resumeId: resume.id } });
  await prisma.application.update({ where: { id: application.id }, data: { status: 'INTERVIEW_COMPLETED', finalScore: 77 } });
  return { cand, application, email };
}

async function main() {
  step('0. Flag off on the dev server');
  const devCfg = await call('/config/public', { base: DEV_BASE });
  assert(typeof devCfg.data?.clientPortal === 'boolean', `config exposes clientPortal (${devCfg.data?.clientPortal})`);

  step('1. Agency, client with IT + Finance, one HR person each');
  const owner = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p8-owner-${ts}@test.com`, password: PASSWORD, companyName: `P8 Agency ${ts}` },
  });
  let { client } = await req('/clients', { method: 'POST', token: owner.token, body: { name: `P8 Client ${ts}` } });
  ({ client } = await req(`/clients/${client.id}/departments`, { method: 'POST', token: owner.token, body: { name: 'IT' } }));
  ({ client } = await req(`/clients/${client.id}/departments`, { method: 'POST', token: owner.token, body: { name: 'Finance' } }));
  const it = client.departments.find((d) => d.name === 'IT');
  const fin = client.departments.find((d) => d.name === 'Finance');
  ({ client } = await req(`/clients/departments/${it.id}/hiring-persons`, { method: 'POST', token: owner.token, body: { fullName: 'Ira IT', email: `p8-hr-it-${ts}@test.com` } }));
  // ({ client } = await req(`/clients/departments/${fin.id}/hiring-persons`, { method: 'POST', token: owner.token, body: { fullName: 'Farah Finance', email: `p8-hr-fin-${ts}@test.com` } }));
  // const hrIt = client.departments.find((d) => d.id === it.id).hiringPersons[0];
  // const hrFin = client.departments.find((d) => d.id === fin.id).hiringPersons[0];
  // Second Company HR added directly to the company, with no department.
  ({ client } = await req(`/clients/${client.id}/hiring-persons`, { method: 'POST', token: owner.token, body: { fullName: 'Farah Finance', email: `p8-hr-fin-${ts}@test.com` } }));
  const hrIt = client.hiringPersons.find((p) => p.fullName === 'Ira IT');
  const hrFin = client.hiringPersons.find((p) => p.fullName === 'Farah Finance');
  assert(hrIt.department?.name === 'IT' && hrFin.departmentId === null, 'Company HR with and without a department label');
  assert(hrIt.portalStatus === 'NONE' && !('userId' in hrIt), 'HR people start without a portal login (userId not exposed)');
  const { job } = await req('/jobs', {
    method: 'POST',
    token: owner.token,
    body: { title: `P8 React Dev ${ts}`, description: 'React role for the client portal test.', status: 'OPEN', clientCompanyId: client.id, departmentId: it.id, hiringPersonId: hrIt.id },
  });

  step('2. First submission auto-invites the HR person');
  const a = await completedApplication(owner, job.id, 'alice');
  const sent = await req('/submissions', { method: 'POST', token: owner.token, body: { applicationId: a.application.id } });
  assert(sent.submission.hiringPersonId === hrIt.id, 'submitted to the IT HR person');
  ({ client } = await req(`/clients/${client.id}`, { token: owner.token }));
  // assert(client.departments.find((d) => d.id === it.id).hiringPersons[0].portalStatus === 'INVITED', 'IT HR is now INVITED');
  assert(client.hiringPersons.find((p) => p.id === hrIt.id).portalStatus === 'INVITED', 'IT HR is now INVITED');

  step('3. HR sets a password and opens the portal');
  const resend = await req(`/clients/hiring-persons/${hrIt.id}/invite`, { method: 'POST', token: owner.token });
  const info = await req(`/auth/password-token/${tokenOf(resend.setupLink)}`, { base: BASE });
  assert(info.role === 'CLIENT_HR' && info.companyName === `P8 Client ${ts}`, 'invite link is for a CLIENT_HR login at the client');
  const set = await req('/auth/set-password', { method: 'POST', body: { token: tokenOf(resend.setupLink), password: PASSWORD } });
  const tIt = set.token;
  const me = await req('/auth/me', { token: tIt });
  assert(me.user.role === 'CLIENT_HR' && me.user.hiringPerson?.department === 'IT' && me.user.hiringPerson.recruitmentCompany === `P8 Agency ${ts}`, '/auth/me shows the HR profile');
  const again = await call(`/clients/hiring-persons/${hrIt.id}/invite`, { method: 'POST', token: owner.token });
  assert(again.status === 400 && again.json?.error === 'INVITE_NOT_PENDING', 'no re-invite once the login is active');

  const list = await req('/client-portal/submissions', { token: tIt });
  assert(list.submissions.length === 1 && list.submissions[0].isNew && list.submissions[0].candidateName === 'Portal alice', 'portal lists the one submission as New');
  assert(list.me.department === 'IT' && list.jobs[0]?.id === job.id, 'portal knows the HR person and job filter');
  const detail = await req(`/client-portal/submissions/${list.submissions[0].id}`, { token: tIt });
  assert(detail.snapshot.candidate.email === a.email && detail.snapshot.finalScore === 77, 'candidate package with contact + final score');
  const cvRes = await call(`/client-portal/submissions/${list.submissions[0].id}/cv`, { token: tIt, raw: true });
  assert(cvRes.status === 200 && (cvRes.headers.get('content-type') || '').includes('wordprocessingml'), 'CV opens from the portal');
  const { history } = await req(`/submissions/applications/${a.application.id}`, { token: owner.token });
  assert(history[0].status === 'VIEWED', 'recruiter sees the submission as Viewed');
  const list2 = await req('/client-portal/submissions', { token: tIt });
  assert(!list2.submissions[0].isNew, 'no longer New after opening');

  step('4. Another department sees nothing of it');
  const inv2 = await req(`/clients/hiring-persons/${hrFin.id}/invite`, { method: 'POST', token: owner.token });
  const tFin = (await req('/auth/set-password', { method: 'POST', body: { token: tokenOf(inv2.setupLink), password: PASSWORD } })).token;
  const finList = await req('/client-portal/submissions', { token: tFin });
  assert(finList.submissions.length === 0, 'Finance HR has an empty list');
  assert(finList.me.department === null && finList.me.clientName === `P8 Client ${ts}`, 'HR without a department still knows their company');
  const peek = await call(`/client-portal/submissions/${list.submissions[0].id}`, { token: tFin });
  assert(peek.status === 404, 'Finance HR gets 404 on the IT submission');
  const peekCv = await call(`/client-portal/submissions/${list.submissions[0].id}/cv`, { token: tFin });
  assert(peekCv.status === 404, 'and 404 on its CV');

  step('5. Client HR can\'t reach company or candidate APIs');
  for (const path of ['/jobs/company/mine', '/applications/mine', '/cv-pool', '/clients', '/admin/users', `/submissions/applications/${a.application.id}`]) {
    const r = await call(path, { token: tIt });
    assert(r.status === 403, `${path} → 403`);
  }
  const ownerPortal = await call('/client-portal/submissions', { token: owner.token });
  assert(ownerPortal.status === 403, 'company owner gets 403 on the client portal');

  step('6. Deactivation and suspension');
  await req(`/clients/hiring-persons/${hrIt.id}/status`, { method: 'PATCH', token: owner.token, body: { isActive: false } });
  assert((await call('/auth/me', { token: tIt })).status === 401, 'deactivated HR person → token 401');
  assert((await call('/auth/login', { method: 'POST', body: { email: `p8-hr-it-${ts}@test.com`, password: PASSWORD } })).status === 401, 'and cannot log in');
  await req(`/clients/hiring-persons/${hrIt.id}/status`, { method: 'PATCH', token: owner.token, body: { isActive: true } });
  assert((await call('/auth/me', { token: tIt })).status === 200, 're-activated HR works again');

  const admin = await prisma.user.create({ data: { email: `p8-admin-${ts}@test.com`, passwordHash: await bcrypt.hash(PASSWORD, 10), role: 'ADMIN' } });
  adminId = admin.id;
  const { token: tAdmin } = await req('/auth/login', { method: 'POST', body: { email: admin.email, password: PASSWORD } });
  const companyId = (await req('/auth/me', { token: owner.token })).user.company.id;
  await req(`/admin/companies/${companyId}/status`, { method: 'PATCH', token: tAdmin, body: { status: 'SUSPENDED' } });
  const susp = await call('/client-portal/submissions', { token: tIt });
  assert(susp.status === 403 && susp.json?.error === 'COMPANY_SUSPENDED', 'suspended agency → its clients\' portal is closed');
  await req(`/admin/companies/${companyId}/status`, { method: 'PATCH', token: tAdmin, body: { status: 'ACTIVE' } });

  step('7. Email already used by another account');
  ({ client } = await req(`/clients/departments/${fin.id}/hiring-persons`, { method: 'POST', token: owner.token, body: { fullName: 'Clash', email: a.email } }));
  // const clash = client.departments.find((d) => d.id === fin.id).hiringPersons.find((p) => p.fullName === 'Clash');
  const clash = client.hiringPersons.find((p) => p.fullName === 'Clash');
  const conflict = await call(`/clients/hiring-persons/${clash.id}/invite`, { method: 'POST', token: owner.token });
  assert(conflict.status === 409, 'HR email that belongs to a candidate account → 409');

  console.log(`\nPHASE 8 TESTS PASSED ✔  (${passed} checks)`);
}

let server;
startServer()
  .then((s) => {
    server = s;
    return main();
  })
  .catch((err) => {
    console.error(`\nPHASE 8 TEST FAILED after ${passed} passing checks:`, err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (adminId) await prisma.user.update({ where: { id: adminId }, data: { isActive: false } }).catch(() => {});
    await prisma.$disconnect();
    server?.kill();
  });
