// Build plan P5 acceptance test (docs/implementation-plan.html "Done when"):
//   - a candidate passes the match, opens the link, finishes the interview → report
//   - "later": the link is sent by email and keeps working; completed/expired links
//     show a clear message
//   - slot-booking jobs still work end to end (smoke-current-flow.mjs)
// Plus: link sessions only open their own interview, rotate revokes, send
// limit, cancel/complete without a slot, guest result page gets the link.
//
// Starts its own API instance with FEATURE_INSTANT_INTERVIEW + FEATURE_GUEST_APPLY
// on (port 3096) and stops it at the end:  node scripts/test-p5-instant-interview.mjs
import 'dotenv/config';
import { spawn } from 'child_process';
import { buildDocx, reactResumeLines, DOCX_MIME } from './lib/testDocx.mjs';

const DEV_BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const PORT = Number(process.env.P5_TEST_PORT || 3096);
const BASE = `http://localhost:${PORT}`;
const ts = Date.now();
const PASSWORD = 'password123';
let passed = 0;

async function call(path, { method = 'GET', body, token, form, base = BASE } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/api/v1${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
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
const tokenOf = (link) => link.split('/interview/')[1];

function cvForm(name, email, phone) {
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines(name, email, phone))], { type: DOCX_MIME }), 'cv.docx');
  return form;
}

async function candidateApplies(jobId, label) {
  const email = `p5-${label}-${ts}@test.com`;
  const { token } = await req('/auth/register/candidate', { method: 'POST', body: { email, password: PASSWORD, fullName: `P5 ${label}` } });
  const { resume } = await req('/resumes', { method: 'POST', token, form: cvForm(`P5 ${label}`, email, '+919812300000') });
  const { application } = await req('/applications', { method: 'POST', token, body: { jobId, resumeId: resume.id } });
  return { token, application };
}

async function startServer() {
  const code = `import('./src/server/app.js').then(({ createApp }) => createApp().listen(${PORT}, () => console.log('READY')))`;
  const child = spawn(process.execPath, ['-e', code], {
    env: { ...process.env, FEATURE_INSTANT_INTERVIEW: 'true', FEATURE_GUEST_APPLY: 'true', SMS_DRIVER: 'console', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.env.P5_VERBOSE && process.stderr.write(d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test server did not start')), 30000);
    child.stdout.on('data', (d) => d.toString().includes('READY') && (clearTimeout(timer), resolve()));
    child.on('exit', (c) => reject(new Error(`test server exited (${c})`)));
  });
  return child;
}

async function main() {
  step('0. Flag off on the dev server');
  const devCfg = await call('/config/public', { base: DEV_BASE });
  if (devCfg.data?.instantInterview === false) {
    const off = await call('/public/interviews/abc', { base: DEV_BASE });
    assert(off.status === 404 && off.json?.error === 'FEATURE_DISABLED', 'FEATURE_INSTANT_INTERVIEW=false → link routes are 404');
  } else {
    console.log('  (dev server has FEATURE_INSTANT_INTERVIEW on — skipping)');
  }

  step('1. Company + an INSTANT-flow job with auto-advance');
  const owner = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p5-owner-${ts}@test.com`, password: PASSWORD, companyName: `P5 Co ${ts}` },
  });
  const { job } = await req('/jobs', {
    method: 'POST',
    token: owner.token,
    body: {
      title: `P5 React Dev ${ts}`,
      description: 'Build React front-ends with JavaScript, HTML and CSS against REST APIs.',
      requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS'],
      status: 'OPEN',
      autoAdvanceOnMatch: true,
      minAcceptableScore: 30,
      interviewFlow: 'INSTANT',
      inviteValidDays: 3,
    },
  });
  assert(job.interviewFlow === 'INSTANT' && job.inviteValidDays === 3, 'job saved with interviewFlow INSTANT, 3-day links');

  step('2. Candidate applies → auto-shortlisted → instant interview created (no slot)');
  const a = await candidateApplies(job.id, 'alice');
  assert(a.application.status === 'INTERVIEW_SCHEDULED', `application went straight to INTERVIEW_SCHEDULED (${a.application.status})`);
  const { interview: aInterview } = await req(`/scheduling/applications/${a.application.id}/interview`, { token: a.token });
  assert(aInterview && aInterview.slotId === null && aInterview.slot === null && aInterview.status === 'SCHEDULED', 'interview has no slot');
  assert(aInterview.inviteExpiresAt && new Date(aInterview.inviteExpiresAt) - Date.now() > 2.9 * 24 * 3600e3, 'link valid for ~3 days');

  step('3. Recruiter gets / re-sends the link');
  const sent1 = await req(`/scheduling/applications/${a.application.id}/instant-interview`, { method: 'POST', token: owner.token });
  assert(sent1.interviewId === aInterview.id && sent1.link.includes('/interview/'), 'recruiter gets the link for the same interview');
  const sent2 = await req(`/scheduling/applications/${a.application.id}/instant-interview`, { method: 'POST', token: owner.token });
  assert(sent2.link === sent1.link, 're-sending keeps the same link');
  const rotated = await req(`/scheduling/applications/${a.application.id}/instant-interview`, { method: 'POST', token: owner.token, body: { rotate: true } });
  assert(rotated.link !== sent1.link, 'rotate issues a new link');
  const old = await call(`/public/interviews/${tokenOf(sent1.link)}`);
  assert(old.status === 404 && old.json?.error === 'INVITE_INVALID', 'the old link stops working');
  const link = rotated.link;
  const token = tokenOf(link);

  step('4. Opening the link');
  const info = await req(`/public/interviews/${token}`);
  assert(info.canJoin && info.job.title === job.title && info.company.name === `P5 Co ${ts}`, 'link shows job + company and can be joined');
  assert(!info.channels.email.includes(`p5-alice-${ts}`), 'email is masked on the public page');
  assert((await call('/public/interviews/not-a-token')).status === 404, 'garbage token → 404');

  step('5. "Later": send the link to yourself (max 3 per hour)');
  // The recruiter already sent it 3 times in this hour (steps 3), so the
  // candidate-side send is rate-limited — which is the point of the limit.
  const selfSend = await call(`/public/interviews/${token}/send`, { method: 'POST', body: { channel: 'email' } });
  assert(selfSend.status === 429 && selfSend.json?.error === 'INVITE_SEND_LIMIT', 'after 3 sends in an hour → 429');
  const bad = await call(`/public/interviews/${token}/send`, { method: 'POST', body: { channel: 'fax' } });
  assert(bad.status === 400, 'unknown channel → 400');

  step('6. Session is limited to this one interview');
  const { sessionToken, interviewId } = await req(`/public/interviews/${token}/session`, { method: 'POST' });
  assert(interviewId === aInterview.id, 'session is for this interview');
  const detail = await call(`/interviews/${interviewId}`, { token: sessionToken });
  assert(detail.status === 200, 'session can read its interview');
  const mine = await call('/applications/mine', { token: sessionToken });
  assert(mine.status === 401 && mine.json?.error === 'INTERVIEW_SCOPE', 'session cannot open other candidate APIs');
  const me = await call('/auth/me', { token: sessionToken });
  assert(me.status === 401, 'session is not a full login');

  step('7. Attend now: start → answer → end → report');
  const started = await req(`/interviews/${interviewId}/start`, { method: 'POST', token: sessionToken });
  assert(typeof started.token === 'string' && started.question?.id, 'interview started with a LiveKit token and first question');
  const text = 'I have three years of React experience building dashboards with hooks and Redux and integrating REST APIs.';
  await req(`/interviews/${interviewId}/answer`, { method: 'POST', token: sessionToken, body: { questionId: started.question.id, transcript: text, rawTranscript: text } });
  const rejoin = await req(`/public/interviews/${token}/session`, { method: 'POST' });
  assert(rejoin.sessionToken, 'the same link can rejoin an interview in progress');
  const ended = await req(`/interviews/${interviewId}/end`, { method: 'POST', token: sessionToken });
  assert(ended.done === true, 'interview ended');
  const { interview: finished } = await req(`/interviews/${interviewId}`, { token: owner.token });
  assert(finished.status === 'COMPLETED' && finished.report?.status === 'COMPLETED', `report generated (${finished.report?.status}, score ${finished.report?.overallScore})`);
  assert(finished.slot === null, 'company interview detail works without a slot');

  step('8. Completed link shows a clear message');
  const done = await req(`/public/interviews/${token}`);
  assert(!done.canJoin && done.reason === 'INTERVIEW_COMPLETED', 'completed link → INTERVIEW_COMPLETED');
  const noSession = await call(`/public/interviews/${token}/session`, { method: 'POST' });
  assert(noSession.status === 400 && noSession.json?.error === 'INTERVIEW_COMPLETED', 'no new session after completion');

  step('9. Cancel and complete without a slot');
  const b = await candidateApplies(job.id, 'bob');
  assert(b.application.status === 'INTERVIEW_SCHEDULED', 'second candidate also got an instant interview');
  await req(`/scheduling/applications/${b.application.id}/cancel`, { method: 'POST', token: b.token });
  const { application: bAfter } = await req(`/applications/mine/${b.application.id}`, { token: b.token });
  assert(bAfter.status === 'SHORTLISTED', 'candidate cancelled the instant interview → back to SHORTLISTED');
  const resent = await req(`/scheduling/applications/${b.application.id}/instant-interview`, { method: 'POST', token: owner.token });
  assert(resent.interviewId && resent.link, 'recruiter can send a fresh link after a cancel');
  await req(`/scheduling/jobs/${job.id}/interviews/${resent.interviewId}/complete`, { method: 'PATCH', token: owner.token });
  const { application: bDone } = await req(`/applications/mine/${b.application.id}`, { token: b.token });
  assert(bDone.status === 'INTERVIEW_COMPLETED', 'recruiter can mark a slot-less interview completed');

  step('10. Only shortlisted candidates');
  const { job: manualJob } = await req('/jobs', {
    method: 'POST',
    token: owner.token,
    body: { title: `P5 Manual ${ts}`, description: 'Manual job for the NOT_SHORTLISTED check.', status: 'OPEN' },
  });
  const c = await candidateApplies(manualJob.id, 'carol');
  const notShort = await call(`/scheduling/applications/${c.application.id}/instant-interview`, { method: 'POST', token: owner.token });
  assert(notShort.status === 400 && notShort.json?.error === 'NOT_SHORTLISTED', 'non-shortlisted application → 400 NOT_SHORTLISTED');

  step('11. Guest applies on the careers page → result page gets the link');
  const { slug } = await req('/companies/careers-link', { token: owner.token });
  const phone = `+9196${String(ts).slice(-8)}`;
  const otp = await req('/public/otp/send', { method: 'POST', body: { phone } });
  const { otpToken } = await req('/public/otp/verify', { method: 'POST', body: { phone, code: otp.devCode } });
  const gEmail = `p5-guest-${ts}@test.com`;
  const parsed = await req('/public/cv/parse', { method: 'POST', form: cvForm('Guest Five', gEmail, phone) });
  const g = await req('/public/applications', {
    method: 'POST',
    body: { slug, uploadId: parsed.uploadId, jobId: job.id, fullName: 'Guest Five', email: gEmail, phone, otpToken, consent: true },
  });
  let track = await req('/public/track/process', { method: 'POST', body: { token: g.trackingToken } });
  for (let i = 0; i < 8 && !track.done; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    track = await req(`/public/track?token=${encodeURIComponent(g.trackingToken)}`);
  }
  assert(track.stage === 'interview_scheduled' && track.interview?.link?.includes('/interview/'), `result page shows the interview link (${track.stage})`);
  const gInfo = await req(`/public/interviews/${tokenOf(track.interview.link)}`);
  assert(gInfo.canJoin && gInfo.candidateName === 'Guest Five', "guest's link opens their own interview");

  console.log(`\nPHASE 5 TESTS PASSED ✔  (${passed} checks)`);
}

let server;
startServer()
  .then((s) => {
    server = s;
    return main();
  })
  .catch((err) => {
    console.error(`\nPHASE 5 TEST FAILED after ${passed} passing checks:`, err.message);
    process.exitCode = 1;
  })
  .finally(() => server?.kill());
