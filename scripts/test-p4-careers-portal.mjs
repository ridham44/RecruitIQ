// Build plan P4 acceptance test (docs/implementation-plan.html "Done when"):
//   - a guest applies with OTP, gets screened automatically and sees the result
//   - a CV without a job gets placed on the best-matching job, or marked NO_MATCH
//   - a job with auto-advance off behaves exactly as before (see smoke test)
// Plus: flag off = 404, portal hides internal data, OTP limits/attempts,
// single-use uploads, duplicate applies, CV pool, token misuse.
//
// The dev server normally has FEATURE_GUEST_APPLY off, so this script starts
// its own API instance with the flag on (port 3097) and stops it at the end.
//   node scripts/test-p4-careers-portal.mjs
import 'dotenv/config';
import { spawn } from 'child_process';
import { buildDocx, reactResumeLines, DOCX_MIME } from './lib/testDocx.mjs';

const DEV_BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const PORT = Number(process.env.P4_TEST_PORT || 3097);
const BASE = `http://localhost:${PORT}`;
const ts = Date.now();
const PASSWORD = 'password123';
let passed = 0;

const phoneFor = (n) => `+9197${String(ts).slice(-7)}${n}`;

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

function cvForm(name, email, phone) {
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines(name, email, phone))], { type: DOCX_MIME }), 'cv.docx');
  return form;
}

async function verifyPhone(phone) {
  // Respect the 30-second resend rule instead of tripping it.
  let r = await call('/public/otp/send', { method: 'POST', body: { phone } });
  for (let i = 0; i < 2 && r.status === 429 && /wait/i.test(r.json?.message || ''); i++) {
    await new Promise((res) => setTimeout(res, 31000));
    r = await call('/public/otp/send', { method: 'POST', body: { phone } });
  }
  if (r.status >= 400) throw new Error(r.json?.message || `HTTP ${r.status}`);
  const sent = r.data;
  const { otpToken } = await req('/public/otp/verify', { method: 'POST', body: { phone, code: sent.devCode } });
  return otpToken;
}

async function processUntilDone(token) {
  let s = await req('/public/track/process', { method: 'POST', body: { token } });
  for (let i = 0; i < 10 && !s.done; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    s = await req(`/public/track?token=${encodeURIComponent(token)}`);
  }
  return s;
}

async function startServer() {
  const code = `import('./src/server/app.js').then(({ createApp }) => createApp().listen(${PORT}, () => console.log('READY')))`;
  const child = spawn(process.execPath, ['-e', code], {
    env: { ...process.env, FEATURE_GUEST_APPLY: 'true', SMS_DRIVER: 'console', NODE_ENV: 'development', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.env.P4_VERBOSE && process.stderr.write(d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test server did not start')), 30000);
    child.stdout.on('data', (d) => d.toString().includes('READY') && (clearTimeout(timer), resolve()));
    child.on('exit', (c) => reject(new Error(`test server exited (${c})`)));
  });
  return child;
}

async function main() {
  step('0. Flag off on the dev server → portal answers 404');
  const devCfg = await call('/config/public', { base: DEV_BASE });
  if (devCfg.data?.guestApply === false) {
    const off = await call('/public/careers/anything', { base: DEV_BASE });
    assert(off.status === 404 && off.json?.error === 'FEATURE_DISABLED', 'FEATURE_GUEST_APPLY=false → /public/* is 404');
  } else {
    console.log('  (dev server has FEATURE_GUEST_APPLY on — skipping the flag-off check)');
  }

  step('1. Company, careers link and two jobs');
  const owner = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p4-owner-${ts}@test.com`, password: PASSWORD, companyName: `P4 Talent ${ts}` },
  });
  const link = await req('/companies/careers-link', { token: owner.token });
  assert(link.slug && link.url.endsWith(`/careers/${link.slug}`), `careers link generated (${link.slug})`);
  const again = await req('/companies/careers-link', { token: owner.token });
  assert(again.slug === link.slug, 'careers link is stable');
  const newSlug = `p4-talent-${ts}`;
  const renamed = await req('/companies/careers-link', { method: 'PATCH', token: owner.token, body: { slug: newSlug } });
  assert(renamed.slug === newSlug, 'owner can rename the link');
  const badSlug = await call('/companies/careers-link', { method: 'PATCH', token: owner.token, body: { slug: 'Bad Slug!' } });
  assert(badSlug.status === 400, 'invalid link name rejected');
  const slug = newSlug;

  const { client } = await req('/clients', { method: 'POST', token: owner.token, body: { name: `Secret Client ${ts}` } });
  const jobBody = (title, extra) => ({
    title,
    description: `${title}: build React front-ends with JavaScript, HTML and CSS against REST APIs.`,
    requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS'],
    minimumExperience: 1,
    status: 'OPEN',
    ...extra,
  });
  const { job: autoJob } = await req('/jobs', {
    method: 'POST',
    token: owner.token,
    body: jobBody(`P4 Auto React Dev ${ts}`, { autoAdvanceOnMatch: true, minAcceptableScore: 50, clientCompanyId: client.id }),
  });
  const { job: manualJob } = await req('/jobs', { method: 'POST', token: owner.token, body: jobBody(`P4 Manual React Dev ${ts}`) });
  assert(autoJob.autoAdvanceOnMatch === true && manualJob.autoAdvanceOnMatch === false, 'autoAdvanceOnMatch saved per job (default off)');

  step('2. Public portal');
  const portal = await req(`/public/careers/${slug}`);
  assert(portal.company.name === `P4 Talent ${ts}` && portal.jobs.length === 2, 'portal lists the company and its 2 open jobs');
  const pj = portal.jobs.find((j) => j.id === autoJob.id);
  assert(pj && !('clientCompanyId' in pj) && !('minAcceptableScore' in pj) && !('autoAdvanceOnMatch' in pj), 'portal hides client link and screening settings');
  const pjob = await req(`/public/careers/${slug}/jobs/${autoJob.id}`);
  assert(pjob.job.title === autoJob.title, 'public job detail works');
  assert((await call('/public/careers/no-such-company-xyz')).status === 404, 'unknown portal → 404');

  step('3. Phone OTP');
  const phone1 = phoneFor(1);
  const sent = await req('/public/otp/send', { method: 'POST', body: { phone: phone1 } });
  assert(/^\d{6}$/.test(sent.devCode) && sent.phone === phone1, 'code sent (console driver shows it in dev)');
  const tooSoon = await call('/public/otp/send', { method: 'POST', body: { phone: phone1 } });
  assert(tooSoon.status === 429, 'resend within 30s → 429');
  const wrong = await call('/public/otp/verify', { method: 'POST', body: { phone: phone1, code: sent.devCode === '000000' ? '111111' : '000000' } });
  assert(wrong.status === 400 && wrong.json?.error === 'OTP_INVALID', 'wrong code → 400 OTP_INVALID');
  const { otpToken: otp1 } = await req('/public/otp/verify', { method: 'POST', body: { phone: phone1, code: sent.devCode } });
  assert(otp1, 'right code → otpToken');
  const replay = await call('/public/otp/verify', { method: 'POST', body: { phone: phone1, code: sent.devCode } });
  assert(replay.status === 400, 'a code works only once');
  const asBearer = await call('/auth/me', { token: otp1, base: DEV_BASE });
  assert(asBearer.status === 401, 'an otpToken is not a login session');
  assert((await call('/public/otp/send', { method: 'POST', body: { phone: '12' } })).status === 400, 'invalid phone → 400');

  step('4. Guest applies to the auto-advance job (§6A, §8)');
  const email1 = `p4-guest-${ts}@test.com`;
  const parsed = await req('/public/cv/parse', { method: 'POST', form: cvForm('Priya Guest', email1, phone1) });
  assert(parsed.uploadId && parsed.fileName === 'cv.docx', `CV parsed (detected name: "${parsed.detected.fullName}")`);
  const base = { slug, uploadId: parsed.uploadId, fullName: 'Priya Guest', email: email1, phone: phone1, consent: true };
  const noConsent = await call('/public/applications', { method: 'POST', body: { ...base, jobId: autoJob.id, otpToken: otp1, consent: false } });
  assert(noConsent.status === 400, 'consent is required');
  const wrongPhone = await call('/public/applications', { method: 'POST', body: { ...base, jobId: autoJob.id, otpToken: otp1, phone: phoneFor(9) } });
  assert(wrongPhone.status === 400 && wrongPhone.json?.error === 'OTP_REQUIRED', "otpToken for another phone → 400 OTP_REQUIRED");
  const applied = await req('/public/applications', { method: 'POST', body: { ...base, jobId: autoJob.id, otpToken: otp1 } });
  assert(applied.kind === 'application' && applied.account === 'created', 'guest application created with a new account');
  const reuse = await call('/public/applications', { method: 'POST', body: { ...base, jobId: manualJob.id, otpToken: otp1 } });
  assert(reuse.status === 400 && reuse.json?.error === 'UPLOAD_EXPIRED', 'an upload can be used only once');
  const trackBearer = await call('/auth/me', { token: applied.trackingToken, base: DEV_BASE });
  assert(trackBearer.status === 401, 'a tracking token is not a login session');

  const result1 = await processUntilDone(applied.trackingToken);
  assert(result1.done && ['shortlisted', 'not_selected'].includes(result1.stage), `screened and auto-decided on apply → ${result1.stage}`);
  assert(!('score' in result1) && !JSON.stringify(result1).includes('overallScore'), 'candidate status shows no scores');
  const { applications: autoApps } = await req(`/applications/job/${autoJob.id}`, { token: owner.token });
  const guestApp = autoApps.find((a) => a.id === applied.id);
  assert(guestApp?.source === 'GUEST' && ['SHORTLISTED', 'REJECTED'].includes(guestApp.status), `company sees it as GUEST / ${guestApp?.status}`);
  const ranked = await req(`/screening/job/${autoJob.id}/ranked`, { token: owner.token });
  assert(ranked.ranked.some((r) => r.application.id === applied.id), 'company sees the screening score');

  step('5. Same guest applies to the manual job → screened, not auto-decided');
  const otp1b = await verifyPhone(phone1);
  const parsed2 = await req('/public/cv/parse', { method: 'POST', form: cvForm('Priya Guest', email1, phone1) });
  const applied2 = await req('/public/applications', {
    method: 'POST',
    body: { ...base, uploadId: parsed2.uploadId, jobId: manualJob.id, otpToken: otp1b },
  });
  assert(applied2.account === 'pending', 'returning guest without a password gets a fresh set-password link');
  const result2 = await processUntilDone(applied2.trackingToken);
  assert(result2.stage === 'under_review' && result2.status === 'SCREENING', `auto-advance off → stays SCREENING for the recruiter (${result2.status})`);

  step('6. Duplicate apply');
  const parsed3 = await req('/public/cv/parse', { method: 'POST', form: cvForm('Priya Guest', email1, phone1) });
  const otp1c = await verifyPhone(phone1).catch((e) => e);
  if (otp1c instanceof Error) {
    console.log('  (phone OTP limit reached for this number — expected after 3 codes; using the earlier token)');
  }
  const dup = await call('/public/applications', {
    method: 'POST',
    body: { ...base, uploadId: parsed3.uploadId, jobId: manualJob.id, otpToken: otp1c instanceof Error ? otp1b : otp1c },
  });
  assert(dup.status === 409 && dup.json?.error === 'ALREADY_APPLIED', 'applying twice to the same job → 409');
  const limit = await call('/public/otp/send', { method: 'POST', body: { phone: phone1 } });
  assert(limit.status === 429, 'after 3 codes in 15 minutes the phone is rate-limited');

  step('7. CV without a job → best match (§6B)');
  const phone2 = phoneFor(2);
  const otp2 = await verifyPhone(phone2);
  const email2 = `p4-cvonly-${ts}@test.com`;
  const parsedCv = await req('/public/cv/parse', { method: 'POST', form: cvForm('Arjun Pool', email2, phone2) });
  const sub = await req('/public/applications', {
    method: 'POST',
    body: { slug, uploadId: parsedCv.uploadId, fullName: 'Arjun Pool', email: email2, phone: phone2, otpToken: otp2, consent: true },
  });
  assert(sub.kind === 'submission', 'CV-only submission accepted');
  const subResult = await processUntilDone(sub.trackingToken);
  assert(['MATCHED', 'NO_MATCH'].includes(subResult.status), `matching finished → ${subResult.status}${subResult.match ? ` (${subResult.match.job.title})` : ''}`);
  const again2 = await req('/public/track/process', { method: 'POST', body: { token: sub.trackingToken } });
  assert(again2.status === subResult.status, 'processing again is a no-op');

  step('8. CV pool (company side)');
  const { submissions } = await req('/cv-pool', { token: owner.token });
  const pooled = submissions.find((s) => s.id === sub.id);
  assert(pooled && pooled.candidate.email === email2 && pooled.candidate.phoneVerified, 'owner sees the CV in the pool with a verified phone');
  assert(pooled.matches.every((m) => m.ownJob || !('jobTitle' in m)), "other companies' matched jobs are hidden");
  const target = pooled.placement?.ownJob && pooled.placement.jobId === manualJob.id ? autoJob : manualJob;
  const placed = await call(`/cv-pool/${sub.id}/apply`, { method: 'POST', token: owner.token, body: { jobId: target.id } });
  assert(placed.status === 201, 'recruiter can place the CV on one of their jobs by hand');
  const placedAgain = await call(`/cv-pool/${sub.id}/apply`, { method: 'POST', token: owner.token, body: { jobId: target.id } });
  assert(placedAgain.status === 409, 'placing it twice on the same job → 409');
  const other = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p4-other-${ts}@test.com`, password: PASSWORD, companyName: `P4 Other ${ts}` },
  });
  const { submissions: otherPool } = await req('/cv-pool', { token: other.token });
  assert(!otherPool.some((s) => s.id === sub.id), "another company doesn't see this portal's CV pool");

  step('9. Logged-in candidate on an auto-advance job');
  const cand = await req('/auth/register/candidate', {
    method: 'POST',
    body: { email: `p4-cand-${ts}@test.com`, password: PASSWORD, fullName: 'Logged In Cand' },
  });
  const { resume } = await req('/resumes', {
    method: 'POST',
    token: cand.token,
    form: cvForm('Logged In Cand', `p4-cand-${ts}@test.com`, '+919812345678'),
    base: DEV_BASE,
  });
  const { application: liApp } = await req('/applications', { method: 'POST', token: cand.token, body: { jobId: autoJob.id, resumeId: resume.id }, base: DEV_BASE });
  assert(['SHORTLISTED', 'REJECTED'].includes(liApp.status), `logged-in apply on an auto-advance job is decided right away (${liApp.status})`);

  console.log(`\nPHASE 4 TESTS PASSED ✔  (${passed} checks)`);
}

let server;
startServer()
  .then((s) => {
    server = s;
    return main();
  })
  .catch((err) => {
    console.error(`\nPHASE 4 TEST FAILED after ${passed} passing checks:`, err.message);
    process.exitCode = 1;
  })
  .finally(() => server?.kill());
