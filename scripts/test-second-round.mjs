// Second-round AI interview (retake): requested by Company HR (link to the
// candidate at once + email to the agency) or given by the agency. Round 1
// is kept, round 2 gets its own report, the final score uses the latest
// round, and a candidate already sent to the company stays "Submitted".
//
// Starts its own API on port 3090 (HR portal + instant links on, console
// email) and stops it at the end. Runs one short real AI interview.
//   node scripts/test-second-round.mjs
import 'dotenv/config';
import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { buildDocx, reactResumeLines, DOCX_MIME } from './lib/testDocx.mjs';

const PORT = Number(process.env.ROUND_TEST_PORT || 3090);
const BASE = `http://localhost:${PORT}`;
const ts = Date.now();
const PASSWORD = 'password123';
const prisma = new PrismaClient();
let passed = 0;

async function call(path, { method = 'GET', body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
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
    env: { ...process.env, FEATURE_CLIENT_PORTAL: 'true', FEATURE_INSTANT_INTERVIEW: 'true', FEATURE_GUEST_APPLY: 'true', BREVO_API_KEY: '', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.env.ROUND_VERBOSE && process.stderr.write(d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test server did not start')), 30000);
    child.stdout.on('data', (d) => d.toString().includes('READY') && (clearTimeout(timer), resolve()));
    child.on('exit', (c) => reject(new Error(`test server exited (${c})`)));
  });
  return child;
}

// A finished round 1 without running a whole AI interview.
async function completedRoundOne(applicationId, score) {
  const interview = await prisma.interview.create({
    data: { applicationId, status: 'COMPLETED', stage: 'END', startedAt: new Date(Date.now() - 600000), endedAt: new Date(Date.now() - 60000) },
  });
  await prisma.interviewReport.create({
    data: { interviewId: interview.id, status: 'COMPLETED', overallScore: score, strengths: ['Clear answers'], areasForImprovement: ['Short on detail'], generatedAt: new Date() },
  });
  await prisma.application.update({ where: { id: applicationId }, data: { status: 'INTERVIEW_COMPLETED', finalScore: score } });
  return interview;
}

const mails = (to, type) => prisma.emailLog.findMany({ where: { recipientEmail: to, type }, orderBy: { sentAt: 'asc' } });

async function main() {
  step('0. Agency, company + Company HR, job, candidate with a finished round 1');
  const ownerEmail = `sr-owner-${ts}@test.com`;
  const owner = await req('/auth/register/company', { method: 'POST', body: { email: ownerEmail, password: PASSWORD, companyName: `SR Agency ${ts}` } });
  const tO = owner.token;
  let { client } = await req('/clients', { method: 'POST', token: tO, body: { name: `SR Company ${ts}` } });
  ({ client } = await req(`/clients/${client.id}/hiring-persons`, { method: 'POST', token: tO, body: { fullName: 'Sara HR', email: `sr-hr-${ts}@test.com` } }));
  const hr = client.hiringPersons[0];
  const { job } = await req('/jobs', {
    method: 'POST',
    token: tO,
    body: { title: `SR React Dev ${ts}`, description: 'React role: JavaScript, HTML, CSS and REST APIs.', status: 'OPEN', clientCompanyId: client.id, hiringPersonId: hr.id },
  });
  const cEmail = `sr-cand-${ts}@test.com`;
  const cand = await req('/auth/register/candidate', { method: 'POST', body: { email: cEmail, password: PASSWORD, fullName: 'SR Candidate' } });
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines('SR Candidate', cEmail, '+919822200002'))], { type: DOCX_MIME }), 'cv.docx');
  const { resume } = await req('/resumes', { method: 'POST', token: cand.token, form });
  const { application } = await req('/applications', { method: 'POST', token: cand.token, body: { jobId: job.id, resumeId: resume.id } });
  const round1 = await completedRoundOne(application.id, 55);

  step('1. Agency side before anything');
  let rounds = await req(`/scheduling/applications/${application.id}/rounds`, { token: tO });
  assert(rounds.rounds.length === 1 && rounds.rounds[0].round === 1 && rounds.canRequestSecondRound === true, 'one finished round, second round possible');

  step('2. Submit to Company HR, HR logs in');
  await req('/submissions', { method: 'POST', token: tO, body: { applicationId: application.id, hiringPersonId: hr.id } });
  let app = await prisma.application.findUnique({ where: { id: application.id } });
  assert(app.status === 'SUBMITTED_TO_CLIENT', 'candidate is Submitted to company');
  const inv = await req(`/clients/hiring-persons/${hr.id}/invite`, { method: 'POST', token: tO }).catch(async () => null);
  const link = inv?.setupLink;
  const tHr = link
    ? (await req('/auth/set-password', { method: 'POST', body: { token: tokenOf(link), password: PASSWORD } })).token
    : null;
  assert(tHr, 'Company HR has a portal login');
  const { submissions } = await req('/client-portal/submissions', { token: tHr });
  const subId = submissions[0].id;
  let hrView = await req(`/client-portal/submissions/${subId}`, { token: tHr });
  assert(hrView.canRequestSecondRound === true && hrView.rounds.length === 1, 'HR sees round 1 and may ask for a second round');

  step('3. HR requests a second round');
  const bad = await call(`/client-portal/submissions/${subId}/second-round`, { method: 'POST', token: tHr, body: { reason: 'NOPE' } });
  assert(bad.status === 400, 'unknown reason → 400');
  hrView = await req(`/client-portal/submissions/${subId}/second-round`, {
    method: 'POST',
    token: tHr,
    body: { reason: 'TECHNICAL_ISSUE', notes: 'Mic kept dropping. Focus on SQL.' },
  });
  const r2 = hrView.rounds.find((r) => r.round === 2);
  assert(r2 && r2.status === 'SCHEDULED' && r2.requestedByRole === 'CLIENT_HR' && r2.reason === 'TECHNICAL_ISSUE', 'round 2 created, requested by Company HR');
  assert(!('link' in r2), 'HR does not get the candidate link');
  assert(hrView.canRequestSecondRound === false, 'no further request while it is open');
  app = await prisma.application.findUnique({ where: { id: application.id } });
  assert(app.status === 'SUBMITTED_TO_CLIENT', 'candidate stays Submitted to company');
  const invite = await mails(cEmail, 'INTERVIEW_INVITE');
  assert(invite.length === 1 && /second interview/i.test(invite[0].subject), 'candidate emailed the second-interview link');
  const agencyMail = await mails(ownerEmail, 'SECOND_ROUND_REQUESTED');
  assert(agencyMail.length === 1, 'agency emailed "2nd round requested"');
  const again = await call(`/client-portal/submissions/${subId}/second-round`, { method: 'POST', token: tHr, body: { reason: 'OTHER' } });
  assert(again.status === 409, 'second request while open → 409');

  step('4. Agency sees it, with the link');
  rounds = await req(`/scheduling/applications/${application.id}/rounds`, { token: tO });
  const ar2 = rounds.rounds.find((r) => r.round === 2);
  assert(ar2?.link && ar2.notes === 'Mic kept dropping. Focus on SQL.', 'agency sees round 2, notes and the link');
  const giveAgain = await call(`/scheduling/applications/${application.id}/second-round`, { method: 'POST', token: tO, body: { reason: 'OTHER' } });
  assert(giveAgain.status === 409, 'agency cannot add another while open');

  step('5. Candidate takes round 2 from the link');
  const token = ar2.link.split('/interview/')[1];
  const info = await req(`/public/interviews/${token}`);
  assert(info.canJoin && !info.slot, 'link opens');
  const cancel = await call(`/scheduling/applications/${application.id}/cancel`, { method: 'POST', token: cand.token });
  assert(cancel.status === 400 && cancel.json?.error === 'SECOND_ROUND_NO_CANCEL', 'candidate cannot cancel a second round');
  const { sessionToken, interviewId } = await req(`/public/interviews/${token}/session`, { method: 'POST' });
  const started = await req(`/interviews/${interviewId}/start`, { method: 'POST', token: sessionToken });
  assert(started.question?.id, 'round 2 started');
  const text = 'I write SQL daily: joins, window functions and indexes for a reporting dashboard built in React.';
  await req(`/interviews/${interviewId}/answer`, { method: 'POST', token: sessionToken, body: { questionId: started.question.id, transcript: text, rawTranscript: text } });
  const ended = await req(`/interviews/${interviewId}/end`, { method: 'POST', token: sessionToken });
  assert(ended.done === true, 'round 2 ended');

  step('6. After round 2');
  app = await prisma.application.findUnique({ where: { id: application.id } });
  assert(app.status === 'SUBMITTED_TO_CLIENT', 'still Submitted to company');
  const r1 = await prisma.interview.findUnique({ where: { id: round1.id }, include: { report: true } });
  assert(r1.status === 'COMPLETED' && r1.report.overallScore === 55, 'round 1 and its report kept');
  const done2 = await prisma.interview.findUnique({ where: { id: interviewId }, include: { report: true } });
  assert(done2.status === 'COMPLETED' && done2.round === 2, 'round 2 completed');
  if (done2.report?.status === 'COMPLETED') {
    assert(Math.abs(app.finalScore - done2.report.overallScore) < 0.11, `final score uses round 2 (${app.finalScore})`);
  } else {
    console.log('  (round 2 report not ready — AI report generation skipped/failed; final-score check skipped)');
  }
  hrView = await req(`/client-portal/submissions/${subId}`, { token: tHr });
  assert(hrView.rounds.length === 2 && hrView.rounds[1].status === 'COMPLETED', 'HR sees round 2 completed');
  assert(hrView.canRequestSecondRound === false, 'limit: no third round');
  const third = await call(`/client-portal/submissions/${subId}/second-round`, { method: 'POST', token: tHr, body: { reason: 'OTHER' } });
  assert(third.status === 409 && third.json?.error === 'ROUND_LIMIT', 'third round → 409 ROUND_LIMIT');

  step('7. Agency-given second round (before submission)');
  const c2Email = `sr-cand2-${ts}@test.com`;
  const cand2 = await req('/auth/register/candidate', { method: 'POST', body: { email: c2Email, password: PASSWORD, fullName: 'SR Candidate Two' } });
  const f2 = new FormData();
  f2.append('resume', new Blob([buildDocx(reactResumeLines('SR Candidate Two', c2Email, '+919822200003'))], { type: DOCX_MIME }), 'cv.docx');
  const { resume: res2 } = await req('/resumes', { method: 'POST', token: cand2.token, form: f2 });
  const { application: app2 } = await req('/applications', { method: 'POST', token: cand2.token, body: { jobId: job.id, resumeId: res2.id } });
  const noRound = await call(`/scheduling/applications/${app2.id}/second-round`, { method: 'POST', token: tO, body: { reason: 'OTHER' } });
  assert(noRound.status === 400 && noRound.json?.error === 'NO_COMPLETED_INTERVIEW', 'no second round before a first interview');
  await completedRoundOne(app2.id, 60);
  const given = await req(`/scheduling/applications/${app2.id}/second-round`, { method: 'POST', token: tO, body: { reason: 'NOT_READY', notes: '' } });
  assert(given.link && given.emailed && given.rounds.length === 2, 'agency gave a second round, link emailed');
  const a2 = await prisma.application.findUnique({ where: { id: app2.id } });
  assert(a2.status === 'INTERVIEW_SCHEDULED', 'not yet submitted → back to Interview scheduled');
  const viewOnly = await req('/recruiters', {
    method: 'POST',
    token: tO,
    body: { email: `sr-vo-${ts}@test.com`, fullName: 'SR View', permissions: ['VIEW_CANDIDATES'], jobIds: [job.id] },
  });
  const tV = (await req('/auth/set-password', { method: 'POST', body: { token: tokenOf(viewOnly.setupLink), password: PASSWORD } })).token;
  assert((await call(`/scheduling/applications/${app2.id}/rounds`, { token: tV })).status === 200, 'view-only recruiter can read rounds');
  assert((await call(`/scheduling/applications/${application.id}/second-round`, { method: 'POST', token: tV, body: { reason: 'OTHER' } })).status === 403, 'but cannot give one');

  console.log(`\nSECOND-ROUND TESTS PASSED ✔  (${passed} checks)`);
}

let server;
startServer()
  .then((s) => {
    server = s;
    return main();
  })
  .catch((err) => {
    console.error(`\nSECOND-ROUND TEST FAILED after ${passed} passing checks:`, err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    server?.kill();
    await prisma.$disconnect();
  });
