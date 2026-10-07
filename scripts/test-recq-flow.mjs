// Build plan P9 acceptance + security test for the /recq agency-link flow.
// Runs against an ALREADY RUNNING API (default http://localhost:3001) that
// has FEATURE_RECQ on and email in console mode (so OTP codes come back as
// devCode). It creates its own timestamped agencies/jobs, so point it at a
// development database only — never production.
//
//   RECQ_TEST_BASE=http://localhost:3001 node scripts/test-recq-flow.mjs
//
// Covers: agency/job isolation, closed jobs, resume match (strong/weak),
// multi-job discovery + separate applications, duplicates, email OTP
// (resume email only, wrong/expired/reused/attempts/cooldown), recqToken
// binding, interview token isolation, interview window (before/after, window
// change sync, direct-start bypass), LiveKit token, suspended agency,
// recruiter cross-agency access, both screening modes.
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { buildDocx, DOCX_MIME } from './lib/testDocx.mjs';

const BASE = (process.env.RECQ_TEST_BASE || 'http://localhost:3001').replace(/\/$/, '');
const ts = Date.now();
const PASSWORD = 'Password123';
const prisma = new PrismaClient();
let passed = 0;
const failures = [];

async function call(path, { method = 'GET', body, token, form, ip } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  // Distinct client IPs per scenario keep the per-IP OTP limit out of the way
  // (the API trusts one proxy hop, like Vercel / the Vite dev proxy).
  if (ip) headers['X-Forwarded-For'] = ip;
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data, code: json?.error };
}

async function req(path, opts) {
  const r = await call(path, opts);
  if (r.status >= 400) throw new Error(`${opts?.method || 'GET'} ${path} -> ${r.status} ${r.code || ''} ${r.json?.message || ''}`);
  return r.data;
}

function check(cond, msg, detail) {
  if (cond) {
    passed++;
    console.log('  ok  ', msg);
  } else {
    failures.push(msg);
    console.log('  FAIL', msg, detail !== undefined ? `→ ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : '');
  }
}

const step = (t) => console.log(`\n== ${t} ==`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenFromLink = (link) => String(link || '').split('/interview/')[1];

// ─── Realistic fictional resumes ───
function resume(lines, name = 'cv.docx') {
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(lines)], { type: DOCX_MIME }), name);
  return form;
}
const strongReact = (name, email) => [
  name,
  `${email}  |  +91 98765 43210  |  Pune, India`,
  '',
  'SUMMARY',
  'Frontend engineer with 4 years of experience building production React and TypeScript applications.',
  '',
  'SKILLS',
  'React, Redux, TypeScript, JavaScript, HTML5, CSS3, Tailwind CSS, Node.js, Express, MongoDB, REST APIs, Jest, Git',
  '',
  'EXPERIENCE',
  'Senior Frontend Developer — Brightpath Software, Pune (2022 – Present)',
  '- Built a React + TypeScript dashboard used by 40,000 monthly users; cut bundle size by 35%.',
  '- Led migration from class components to hooks and Redux Toolkit.',
  'Frontend Developer — Kitesoft Labs, Pune (2020 – 2022)',
  '- Developed MERN-stack features (MongoDB, Express, React, Node.js) for an e-commerce platform.',
  '',
  'EDUCATION',
  'B.E. Computer Engineering — Savitribai Phule Pune University (2020), CGPA 8.4',
];
const weakChef = (name, email) => [
  name,
  `${email}  |  +91 90000 11111  |  Goa, India`,
  '',
  'SUMMARY',
  'Hospitality professional with 6 years of experience in hotel kitchens and banquet operations.',
  '',
  'SKILLS',
  'Continental cuisine, menu planning, food safety (HACCP), inventory management, team supervision',
  '',
  'EXPERIENCE',
  'Sous Chef — Seaside Resort, Goa (2019 – Present)',
  'Commis Chef — Hotel Royal Palms, Mumbai (2017 – 2019)',
  '',
  'EDUCATION',
  'Diploma in Hotel Management — IHM Goa (2017)',
];
const noEmailCv = (name) => [name, 'Pune, India', '', 'SKILLS', 'React, JavaScript, HTML, CSS', '', 'EXPERIENCE', 'Frontend Developer — 3 years'];

// ─── Setup helpers ───
// Agencies are onboarded by the Portal Admin (no sign-up): invite link →
// the owner sets a password from it.
let adminToken = null;
async function registerAgency(label) {
  const email = `recq-${label}-${ts}@test.com`;
  const { setupLink } = await req('/admin/companies', { method: 'POST', token: adminToken, body: { companyName: `RecQ Test ${label} ${ts}`, ownerEmail: email } });
  const { token, user } = await req('/auth/set-password', { method: 'POST', body: { token: new URL(setupLink).searchParams.get('token'), password: PASSWORD } });
  const link = await req('/companies/careers-link', { token });
  return { token, user, email, slug: link.slug };
}

async function createJob(token, data) {
  const { job } = await req('/jobs', {
    method: 'POST',
    token,
    body: {
      description:
        'We are hiring an engineer to build and maintain production web applications with a modern stack, collaborate with product, and ship reliable features.',
      minAcceptableScore: 60,
      ...data,
    },
  });
  return job;
}

// Sends an OTP for an upload, waiting out the 30-second resend rule if needed.
async function sendOtp(slug, uploadId, ip, extra = {}) {
  let r = await call(`/recq/${slug}/otp/send`, { method: 'POST', body: { uploadId, ...extra }, ip });
  for (let i = 0; i < 2 && r.status === 429 && /wait/i.test(r.json?.message || ''); i++) {
    await sleep(31000);
    r = await call(`/recq/${slug}/otp/send`, { method: 'POST', body: { uploadId, ...extra }, ip });
  }
  return r;
}

async function verified(slug, uploadId, ip) {
  const sent = await sendOtp(slug, uploadId, ip);
  if (sent.status >= 400) throw new Error(`otp send failed ${sent.status} ${sent.json?.message}`);
  const v = await req(`/recq/${slug}/otp/verify`, { method: 'POST', body: { uploadId, code: sent.data.devCode }, ip });
  return v.recqToken;
}

async function main() {
  console.log(`RecQ flow test against ${BASE}`);
  const health = await call('/config/public');
  if (!health.data?.recq) throw new Error('FEATURE_RECQ is off on this server');

  step('Setup: admin, two agencies (onboarded by the admin), jobs (open + closed)');
  const adminEmail = `recq-admin-${ts}@test.com`;
  await prisma.user.create({ data: { email: adminEmail, passwordHash: await bcrypt.hash(PASSWORD, 10), role: 'ADMIN' } });
  const admin = await req('/auth/login', { method: 'POST', body: { email: adminEmail, password: PASSWORD } });
  adminToken = admin.token;
  const selfReg = await call('/auth/register/company', { method: 'POST', body: { email: `self-${ts}@test.com`, password: PASSWORD, companyName: 'Self Signup' } });
  if (health.data.allowCompanySelfRegister === false) check(selfReg.status === 403, 'agency self sign-up is refused — only the admin adds agencies', selfReg.status);
  const A = await registerAgency('A');
  const B = await registerAgency('B');
  const reactJob = await createJob(A.token, {
    title: 'React Frontend Developer',
    requiredSkills: ['React', 'JavaScript', 'TypeScript'],
    minimumExperience: 2,
    location: 'Pune',
  });
  const mernJob = await createJob(A.token, {
    title: 'MERN Stack Developer',
    requiredSkills: ['MongoDB', 'Express', 'React', 'Node.js'],
    minimumExperience: 2,
    location: 'Remote',
    workMode: 'Remote',
  });
  const windowJob = await createJob(A.token, {
    title: 'Frontend Engineer Windowed',
    requiredSkills: ['React', 'JavaScript'],
    minimumExperience: 1,
    interviewAvailabilityStart: new Date(Date.now() + 2 * 864e5).toISOString(),
    interviewAvailabilityEnd: new Date(Date.now() + 4 * 864e5).toISOString(),
  });
  const expiredJob = await createJob(A.token, {
    title: 'UI Developer Expired Window',
    requiredSkills: ['React', 'CSS'],
    minimumExperience: 1,
    interviewAvailabilityStart: new Date(Date.now() - 4 * 864e5).toISOString(),
    interviewAvailabilityEnd: new Date(Date.now() - 3600e3).toISOString(),
  });
  const closedJob = await createJob(A.token, { title: 'Legacy jQuery Developer', requiredSkills: ['jQuery'] });
  await req(`/jobs/${closedJob.id}`, { method: 'DELETE', token: A.token });
  const bJob = await createJob(B.token, { title: 'Data Scientist Bravo', requiredSkills: ['Python', 'Pandas'] });
  check(Boolean(reactJob.slug && mernJob.slug && closedJob.slug && bJob.slug), 'every created job gets a public slug');


  step('Agency page isolation');
  const pageA = await req(`/recq/${A.slug}`);
  const slugsA = pageA.jobs.map((j) => j.slug);
  check(pageA.agency.name.includes('RecQ Test A'), 'agency A page shows agency A branding');
  check(slugsA.includes(reactJob.slug) && slugsA.includes(mernJob.slug), "agency A page lists A's open jobs");
  check(!slugsA.includes(closedJob.slug), 'closed job is not listed');
  check(!slugsA.includes(bJob.slug), "agency B's job never appears on agency A");
  check(pageA.jobs.every((j) => j.id === undefined), 'public job payload does not expose internal ids');
  check(
    pageA.jobs.every((j) => j.minAcceptableScore === undefined && j.createdBy === undefined && j.hiringPersonId === undefined),
    'public job payload hides thresholds / internal fields',
  );
  const pageB = await req(`/recq/${B.slug}`);
  check(pageB.jobs.length === 1 && pageB.jobs[0].slug === bJob.slug, 'agency B page lists only B jobs');
  check((await call('/recq/no-such-agency-xyz')).status === 404, 'unknown agency → 404');
  check((await call(`/recq/${encodeURIComponent("a' OR '1'='1")}`)).status === 404, 'injection-looking slug → 404');

  step('Specific job isolation');
  const jr = await req(`/recq/${A.slug}/jobs/${reactJob.slug}`);
  check(jr.job.title === 'React Frontend Developer' && jr.job.id === undefined, 'specific job returns only that job (by slug)');
  check((await call(`/recq/${A.slug}/jobs/${closedJob.slug}`)).status === 404, 'closed job direct URL → 404');
  check((await call(`/recq/${A.slug}/jobs/${bJob.slug}`)).status === 404, "agency A + agency B's job slug → 404");
  check((await call(`/recq/${B.slug}/jobs/${reactJob.slug}`)).status === 404, "agency B + agency A's job slug → 404");
  check((await call(`/recq/${A.slug}/jobs/does-not-exist`)).status === 404, 'invalid job slug → 404');
  check(
    (await call(`/recq/${A.slug}/jobs/${bJob.slug}/match`, { method: 'POST', form: resume(strongReact('X Y', `x-${ts}@example.com`)) })).status === 404,
    'cannot match against another agency job',
  );
  check(
    (await call(`/recq/${A.slug}/jobs/${closedJob.slug}/match`, { method: 'POST', form: resume(strongReact('X Y', `x2-${ts}@example.com`)) })).status === 404,
    'cannot match against a closed job',
  );

  step('Resume match — strong candidate, single job (Option A / Part 2)');
  const strongEmail = `aarav.strong-${ts}@example.com`;
  const mStrong = await req(`/recq/${A.slug}/jobs/${reactJob.slug}/match`, { method: 'POST', form: resume(strongReact('Aarav Mehta', strongEmail)) });
  console.log('       strong match score:', mStrong.match.score, mStrong.match.breakdown);
  check(mStrong.match.pass === true && mStrong.match.score >= 60, 'strong React resume passes the React job', mStrong.match);
  check(mStrong.hasResumeEmail && /•/.test(mStrong.resumeEmail) && !mStrong.resumeEmail.includes(strongEmail.split('@')[0]), 'resume email extracted and returned masked only');
  check(mStrong.match.reasoning === undefined && mStrong.match.concerns === undefined, 'no internal AI reasoning in candidate response');
  check(
    (await prisma.application.count({ where: { job: { id: reactJob.id } } })) === 0,
    'matching alone creates no application (applications only after OTP)',
  );

  step('Resume match — weak candidate stops');
  const weakEmail = `rohan.weak-${ts}@example.com`;
  const mWeak = await req(`/recq/${A.slug}/jobs/${reactJob.slug}/match`, { method: 'POST', form: resume(weakChef('Rohan Desai', weakEmail)) });
  console.log('       weak match score:', mWeak.match.score);
  check(mWeak.match.pass === false, 'chef resume does not pass the React job', mWeak.match);
  const weakToken = await verified(A.slug, mWeak.uploadId, '10.1.0.2');
  const weakApply = await req(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mWeak.uploadId, jobSlugs: [reactJob.slug], recqToken: weakToken } });
  check(weakApply.anyEligible === false && weakApply.applications[0].eligible === false && !weakApply.applications[0].interview, 'low match → no interview even if the frontend is skipped');
  check(
    (await prisma.application.count({ where: { jobId: reactJob.id, candidate: { user: { email: weakEmail } } } })) === 0,
    'low match → no application row created (server re-scores)',
  );

  step('Email OTP — resume email only, wrong / attempts / expired / reuse / cooldown');
  const ipS = '10.1.0.1';
  const injected = await sendOtp(A.slug, mStrong.uploadId, ipS, { email: `attacker-${ts}@example.com`, jobSlug: reactJob.slug });
  check(injected.status === 200 && injected.data.devCode && injected.data.emailMasked === mStrong.resumeEmail, 'OTP goes to the resume email even when another email is injected');
  const lastLog = await prisma.emailLog.findFirst({ where: { type: 'OTP_VERIFICATION' }, orderBy: { sentAt: 'desc' } });
  check(lastLog?.recipientEmail === strongEmail, 'email log recipient is the resume email', lastLog?.recipientEmail);
  check(!(await prisma.emailLog.findFirst({ where: { recipientEmail: `attacker-${ts}@example.com` } })), 'nothing was ever sent to the injected address');
  const otpRow = await prisma.emailOtp.findFirst({ where: { email: strongEmail }, orderBy: { createdAt: 'desc' } });
  check(otpRow && otpRow.codeHash !== injected.data.devCode && otpRow.codeHash.startsWith('$2'), 'OTP stored as a bcrypt hash, never plain');
  const cooldown = await call(`/recq/${A.slug}/otp/send`, { method: 'POST', body: { uploadId: mStrong.uploadId }, ip: ipS });
  check(cooldown.status === 429, 'resend inside 30 s cooldown → 429', cooldown.status);
  const wrong = await call(`/recq/${A.slug}/otp/verify`, { method: 'POST', body: { uploadId: mStrong.uploadId, code: injected.data.devCode === '000000' ? '111111' : '000000' }, ip: ipS });
  check(wrong.status === 400 && wrong.code === 'OTP_INVALID', 'wrong OTP → OTP_INVALID with attempts left', wrong.json?.message);
  check((await call(`/recq/${A.slug}/otp/verify`, { method: 'POST', body: { uploadId: mStrong.uploadId, code: 'abc' } })).status === 400, 'malformed OTP rejected by validation');
  const good = await req(`/recq/${A.slug}/otp/verify`, { method: 'POST', body: { uploadId: mStrong.uploadId, code: injected.data.devCode }, ip: ipS });
  check(Boolean(good.recqToken), 'correct OTP → recqToken');
  const reuse = await call(`/recq/${A.slug}/otp/verify`, { method: 'POST', body: { uploadId: mStrong.uploadId, code: injected.data.devCode }, ip: ipS });
  check(reuse.status === 400, 'OTP cannot be reused', reuse.code);

  // Attempts limit + expiry on a separate candidate.
  const attEmail = `meera.attempts-${ts}@example.com`;
  const mAtt = await req(`/recq/${A.slug}/jobs/${reactJob.slug}/match`, { method: 'POST', form: resume(strongReact('Meera Iyer', attEmail)) });
  const sentAtt = await sendOtp(A.slug, mAtt.uploadId, '10.1.0.3');
  const bad = sentAtt.data.devCode === '999999' ? '888888' : '999999';
  let last;
  for (let i = 0; i < 5; i++) last = await call(`/recq/${A.slug}/otp/verify`, { method: 'POST', body: { uploadId: mAtt.uploadId, code: bad } });
  check(last.code === 'OTP_TOO_MANY_ATTEMPTS', '5 wrong attempts lock the code', last.code);
  const afterLock = await call(`/recq/${A.slug}/otp/verify`, { method: 'POST', body: { uploadId: mAtt.uploadId, code: sentAtt.data.devCode } });
  check(afterLock.status === 400, 'even the right code fails once locked', afterLock.code);
  await sleep(31000);
  const sentExp = await sendOtp(A.slug, mAtt.uploadId, '10.1.0.3');
  await prisma.emailOtp.updateMany({ where: { email: attEmail, verifiedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const expired = await call(`/recq/${A.slug}/otp/verify`, { method: 'POST', body: { uploadId: mAtt.uploadId, code: sentExp.data.devCode } });
  check(expired.code === 'OTP_EXPIRED', 'expired OTP → OTP_EXPIRED', expired.code);

  // Resume without an email can never get an OTP.
  const mNoEmail = await req(`/recq/${A.slug}/jobs/${reactJob.slug}/match`, { method: 'POST', form: resume(noEmailCv('Kabir Shah')) });
  check(mNoEmail.hasResumeEmail === false, 'resume without email detected');
  const noEmailOtp = await call(`/recq/${A.slug}/otp/send`, { method: 'POST', body: { uploadId: mNoEmail.uploadId }, ip: '10.1.0.4' });
  check(noEmailOtp.status === 400 && noEmailOtp.code === 'NO_RESUME_EMAIL', 'resume without email cannot receive an OTP', noEmailOtp.code);

  step('recqToken binding — cannot skip or reuse verification');
  check((await call(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mStrong.uploadId, jobSlugs: [reactJob.slug] } })).status === 400, 'apply without recqToken → 400');
  const forged = jwt.sign({ typ: 'recq', email: strongEmail, agencyId: B.user.company?.id || 'x', uploadId: mStrong.uploadId }, 'not-the-secret');
  check((await call(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mStrong.uploadId, jobSlugs: [reactJob.slug], recqToken: forged } })).code === 'OTP_REQUIRED', 'forged recqToken rejected');
  check((await call(`/recq/${B.slug}/apply`, { method: 'POST', body: { uploadId: mStrong.uploadId, jobSlugs: [bJob.slug], recqToken: good.recqToken } })).code === 'OTP_REQUIRED', "agency A's verification cannot be used at agency B");
  check((await call(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mAtt.uploadId, jobSlugs: [reactJob.slug], recqToken: good.recqToken } })).code === 'OTP_REQUIRED', "one upload's verification cannot be used for another resume");
  const crossJob = await call(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mStrong.uploadId, jobSlugs: [bJob.slug, closedJob.slug], recqToken: good.recqToken } });
  check(crossJob.status === 400 && crossJob.code === 'JOB_NOT_OPEN', "apply with another agency's / closed job slugs → rejected", crossJob.code);

  step('Apply — strong candidate gets windowless interview access');
  const applyStrong = await req(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mStrong.uploadId, jobSlugs: [reactJob.slug, bJob.slug], recqToken: good.recqToken } });
  const appS = applyStrong.applications.find((a) => a.jobSlug === reactJob.slug);
  check(applyStrong.applications.length === 1 && appS?.eligible && appS.interview?.link, "eligible → interview link; other agency's job silently ignored");
  const appRow = await prisma.application.findFirst({ where: { jobId: reactJob.id, candidate: { user: { email: strongEmail } } }, include: { screeningResult: true, interviews: true } });
  check(appRow?.source === 'RECQ' && appRow.status === 'INTERVIEW_SCHEDULED', 'application is RECQ + INTERVIEW_SCHEDULED (no screen/shortlist gate)', appRow?.status);
  check(appRow?.screeningResult?.status === 'COMPLETED' && appRow.screeningResult.overallScore != null, 'CV match persisted for recruiters');
  check(
    Math.round(appRow?.screeningResult?.overallScore) === mStrong.match.score && appS.matchScore === mStrong.match.score,
    'stored score is exactly the score the candidate was shown',
    `${appRow?.screeningResult?.overallScore} vs shown ${mStrong.match.score}`,
  );
  check(appRow?.interviews.length === 1 && appRow.interviews[0].accessTokenHash && appRow.interviews[0].accessTokenHash !== tokenFromLink(appS.interview.link), 'one interview, only the token hash is stored');
  const accessMail = await prisma.emailLog.findFirst({ where: { type: 'INTERVIEW_INVITE', recipientEmail: strongEmail } });
  check(Boolean(accessMail), 'interview link emailed to the verified resume email');

  step('Duplicate application');
  const mDup = await req(`/recq/${A.slug}/jobs/${reactJob.slug}/match`, { method: 'POST', form: resume(strongReact('Aarav Mehta', strongEmail)) });
  await sleep(31000); // per-email cooldown from the earlier code
  const dupToken = await verified(A.slug, mDup.uploadId, '10.1.0.5');
  const dup = await req(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mDup.uploadId, jobSlugs: [reactJob.slug], recqToken: dupToken } });
  check(dup.applications[0].alreadyApplied === true && dup.applications[0].interview?.link === appS.interview.link, 'same email + job → "already applied", same interview link');
  check((await prisma.application.count({ where: { jobId: reactJob.id, candidate: { user: { email: strongEmail } } } })) === 1, 'no duplicate application row');

  step('Option B — discovery across the agency, multi-job apply');
  const multiEmail = `diya.multi-${ts}@example.com`;
  const disc = await req(`/recq/${A.slug}/match`, { method: 'POST', form: resume(strongReact('Diya Kapoor', multiEmail)) });
  console.log('       discovery:', disc.jobs.map((j) => `${j.title}=${j.score}${j.pass ? '✓' : '✗'}`).join(', '));
  check(disc.jobs.every((j) => [reactJob.slug, mernJob.slug, windowJob.slug, expiredJob.slug].includes(j.slug)), "discovery only scores agency A's OPEN jobs");
  check(!disc.jobs.some((j) => j.slug === bJob.slug || j.slug === closedJob.slug), 'discovery never includes other-agency or closed jobs');
  const picks = disc.jobs.filter((j) => j.pass && [reactJob.slug, mernJob.slug].includes(j.slug)).map((j) => j.slug);
  check(picks.length === 2, 'React + MERN both eligible for the MERN resume', disc.jobs);
  const multiToken = await verified(A.slug, disc.uploadId, '10.1.0.6');
  const multi = await req(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: disc.uploadId, jobSlugs: picks, recqToken: multiToken } });
  const links = multi.applications.map((a) => a.interview?.link).filter(Boolean);
  check(multi.applications.length === 2 && links.length === 2 && links[0] !== links[1], 'two separate applications, two different interview links');
  check(
    multi.applications.every((a) => a.matchScore === disc.jobs.find((j) => j.slug === a.jobSlug)?.score),
    'each application keeps the discovery score the candidate saw',
    multi.applications.map((a) => `${a.jobSlug}:${a.matchScore}`).join(' '),
  );
  check(multi.applications[0].matchScore >= multi.applications[1].matchScore, 'results are ordered best match first');
  const multiApps = await prisma.application.findMany({ where: { candidate: { user: { email: multiEmail } } }, include: { interviews: true, screeningResult: true } });
  check(multiApps.length === 2 && new Set(multiApps.map((a) => a.jobId)).size === 2, 'two application rows on two jobs');
  check(multiApps.every((a) => a.interviews.length === 1 && a.screeningResult?.overallScore != null), 'each application has its own interview + score');
  check((await prisma.resume.count({ where: { candidate: { user: { email: multiEmail } } } })) === 1, 'one resume shared by both applications');

  step('Interview token isolation + LiveKit');
  const [tokReact, tokMern] = multi.applications.map((a) => tokenFromLink(a.interview.link));
  const invReact = await req(`/public/interviews/${tokReact}`);
  const invMern = await req(`/public/interviews/${tokMern}`);
  check(invReact.canJoin && invMern.canJoin && invReact.interviewId !== invMern.interviewId, 'each link opens its own interview');
  check(invReact.job.title !== invMern.job.title, 'each link shows its own job');
  check((await call(`/public/interviews/${'a'.repeat(64)}`)).status === 404, 'random token → 404');
  const sess = await req(`/public/interviews/${tokReact}/session`, { method: 'POST' });
  check(Boolean(sess.sessionToken), 'link → scoped session token');
  check((await call(`/interviews/${invReact.interviewId}/state`, { token: sess.sessionToken })).status === 200, 'session works on its own interview');
  const cross = await call(`/interviews/${invMern.interviewId}/state`, { token: sess.sessionToken });
  check(cross.status === 401 || cross.status === 403, "session for job A's interview cannot read job B's interview", cross.status);
  const crossStart = await call(`/interviews/${invMern.interviewId}/start`, { method: 'POST', token: sess.sessionToken });
  check(crossStart.status === 401 || crossStart.status === 403, "session for interview A cannot start interview B", crossStart.status);
  check((await call(`/applications/job/${reactJob.id}`, { token: sess.sessionToken })).status >= 401, 'interview session cannot reach recruiter APIs');
  const started = await call(`/interviews/${invReact.interviewId}/start`, { method: 'POST', token: sess.sessionToken });
  const lkOk = started.status === 200 && started.data.token?.split('.').length === 3 && started.data.roomName === `interview-${invReact.interviewId}` && /^wss?:\/\//.test(started.data.url);
  check(lkOk, 'start → LiveKit room token for this interview only', started.status === 200 ? started.data.roomName : started.json?.message);
  if (started.status === 200) {
    check(Boolean(started.data.question?.text) && started.data.aiName, 'first (introduction) question generated with interviewer persona');
    const lkPayload = jwt.decode(started.data.token);
    check(lkPayload?.video?.room === `interview-${invReact.interviewId}` && lkPayload.video.roomJoin === true, 'LiveKit grant is scoped to that one room');
  }

  step('Interview window — backend enforcement');
  const winEmail = `ishaan.window-${ts}@example.com`;
  const mWin = await req(`/recq/${A.slug}/jobs/${windowJob.slug}/match`, { method: 'POST', form: resume(strongReact('Ishaan Rao', winEmail)) });
  const winToken = await verified(A.slug, mWin.uploadId, '10.1.0.7');
  const winApply = await req(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mWin.uploadId, jobSlugs: [windowJob.slug], recqToken: winToken } });
  const tokWin = tokenFromLink(winApply.applications[0].interview?.link);
  const invWin = await req(`/public/interviews/${tokWin}`);
  check(invWin.canJoin === false && invWin.reason === 'INTERVIEW_NOT_OPEN', 'before window → not available yet', invWin.reason);
  check(invWin.window?.start && invWin.window?.end, 'link page receives the configured window');
  check((await call(`/public/interviews/${tokWin}/session`, { method: 'POST' })).code === 'INTERVIEW_NOT_OPEN', 'before window → no session issued');
  // A candidate who is logged in normally (e.g. existing account) must not
  // be able to bypass the window by calling start directly.
  const winApp = await prisma.application.findFirst({ where: { jobId: windowJob.id }, include: { candidate: { include: { user: true } }, interviews: true } });
  const loginJwt = jwt.sign({ sub: winApp.candidate.user.id, role: 'CANDIDATE', email: winApp.candidate.user.email }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const bypass = await call(`/interviews/${winApp.interviews[0].id}/start`, { method: 'POST', token: loginJwt });
  check(bypass.status === 400 && bypass.code === 'INTERVIEW_NOT_OPEN', 'direct start before the window is blocked on the backend', `${bypass.status} ${bypass.code}`);
  // Recruiter moves the window to "now": the SAME link opens.
  await req(`/jobs/${windowJob.id}`, {
    method: 'PATCH',
    token: A.token,
    body: { interviewAvailabilityStart: new Date(Date.now() - 3600e3).toISOString(), interviewAvailabilityEnd: new Date(Date.now() + 7 * 864e5).toISOString() },
  });
  const invWin2 = await req(`/public/interviews/${tokWin}`);
  check(invWin2.canJoin === true, 'window moved to now → same link becomes joinable', invWin2.reason);
  check(new Date(invWin2.expiresAt).getTime() > Date.now() + 6 * 864e5, 'link expiry follows the new window end', invWin2.expiresAt);

  const expEmail = `tara.expired-${ts}@example.com`;
  const mExp = await req(`/recq/${A.slug}/jobs/${expiredJob.slug}/match`, { method: 'POST', form: resume(strongReact('Tara Nair', expEmail)) });
  const expToken = await verified(A.slug, mExp.uploadId, '10.1.0.8');
  const expApply = await req(`/recq/${A.slug}/apply`, { method: 'POST', body: { uploadId: mExp.uploadId, jobSlugs: [expiredJob.slug], recqToken: expToken } });
  const tokExp = tokenFromLink(expApply.applications[0].interview?.link);
  const invExp = await req(`/public/interviews/${tokExp}`);
  check(invExp.canJoin === false && invExp.reason === 'INVITE_EXPIRED', 'after window → expired', invExp.reason);
  check((await call(`/public/interviews/${tokExp}/session`, { method: 'POST' })).status === 400, 'after window → no session issued');
  const expApp = await prisma.application.findFirst({ where: { jobId: expiredJob.id }, include: { candidate: { include: { user: true } }, interviews: true } });
  const expJwt = jwt.sign({ sub: expApp.candidate.user.id, role: 'CANDIDATE', email: expApp.candidate.user.email }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const expBypass = await call(`/interviews/${expApp.interviews[0].id}/start`, { method: 'POST', token: expJwt });
  check(expBypass.status === 400 && expBypass.code === 'INVITE_EXPIRED', 'direct start after the window is blocked on the backend', `${expBypass.status} ${expBypass.code}`);

  step('Recruiter side — screening modes + cross-agency access');
  const appsA = await req(`/applications/job/${reactJob.id}`, { token: A.token });
  const list = appsA.applications || appsA;
  check(Array.isArray(list) && list.length >= 1, 'recruiter sees RECQ applicants immediately (no screening needed)');
  const mode1 = await req(`/screening/job/${reactJob.id}/run`, { method: 'POST', token: A.token, body: { force: true } });
  const afterMode1 = await prisma.application.findFirst({ where: { id: appRow.id } });
  check(afterMode1.status === 'INTERVIEW_SCHEDULED', 'mode 1 (applicants) never resets a candidate who already has interview access', `${afterMode1.status} screened=${mode1.screenedCount}`);
  const mode2 = await req(`/screening/job/${reactJob.id}/run-final`, { method: 'POST', token: A.token });
  check(typeof mode2.evaluatedCount === 'number' && typeof mode2.candidateCount === 'number', 'mode 2 (interviewed) endpoint works', mode2);
  check((await call(`/applications/job/${bJob.id}`, { token: A.token })).status === 403, "agency A cannot list agency B's applicants");
  check((await call(`/screening/job/${bJob.id}/run`, { method: 'POST', token: A.token })).status === 403, "agency A cannot screen agency B's job");
  check((await call(`/screening/job/${reactJob.id}/run-final`, { method: 'POST', token: B.token })).status === 403, "agency B cannot run mode 2 on agency A's job");
  check((await call(`/jobs/${reactJob.id}`, { method: 'PATCH', token: B.token, body: { title: 'Hijacked' } })).status === 403, "agency B cannot edit agency A's job");
  check((await call(`/applications/job/${reactJob.id}`)).status === 401, 'no token → 401 on recruiter API');
  check((await call('/admin/companies', { token: A.token })).status === 403, 'agency cannot reach admin API');
  check((await call(`/screening/job/${reactJob.id}/run`, { method: 'POST', token: loginJwt })).status === 403, 'candidate cannot run screening');

  if (health.data.candidateJobBoard === false) {
    step('No cross-agency job board (§1)');
    const board = await call('/jobs');
    check(board.status === 404 && board.code === 'JOB_BOARD_DISABLED', 'GET /jobs (all agencies) is refused', board.status);
    check((await call(`/jobs/${reactJob.id}`)).status === 404, 'job by id without login → 404');
    check((await call(`/jobs/${reactJob.id}`, { token: loginJwt })).status === 404, "a candidate can't open a job they didn't apply to");
    const winJobView = await call(`/jobs/${windowJob.id}`, { token: loginJwt });
    check(winJobView.status === 200 && winJobView.data?.job?.title === windowJob.title, 'a candidate can open the job they applied to');
    const direct = await call('/applications', { method: 'POST', token: loginJwt, body: { jobId: bJob.id, resumeId: 'x' } });
    check(direct.status === 403 && direct.code === 'APPLY_VIA_AGENCY_LINK', "logged-in candidate can't apply to any job id directly", direct.status);
  }

  step('Backward compatibility — old careers API still answers');
  const careers = await call(`/public/careers/${A.slug}`);
  check(careers.status === 200 && careers.data.jobs.some((j) => j.title === 'React Frontend Developer'), 'old /public/careers endpoint unchanged');

  step('Suspended agency');
  await req(`/admin/companies/${B.user.company?.id || (await prisma.company.findFirst({ where: { slug: B.slug } })).id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'SUSPENDED' } });
  check((await call(`/recq/${B.slug}`)).status === 404, 'suspended agency page → 404');
  check((await call(`/recq/${B.slug}/jobs/${bJob.slug}`)).status === 404, 'suspended agency job → 404');
  check((await call(`/recq/${B.slug}/match`, { method: 'POST', form: resume(strongReact('Z Z', `z-${ts}@example.com`)) })).status === 404, 'suspended agency → cannot upload/match');
  await req(`/admin/companies/${(await prisma.company.findFirst({ where: { slug: A.slug } })).id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'SUSPENDED' } });
  const suspendedLink = await call(`/public/interviews/${tokMern}`);
  check(suspendedLink.data?.canJoin === false || suspendedLink.status >= 400, 'existing interview link stops working while the agency is suspended', suspendedLink.data?.reason || suspendedLink.status);
  await req(`/admin/companies/${(await prisma.company.findFirst({ where: { slug: A.slug } })).id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'ACTIVE' } });
  check((await req(`/public/interviews/${tokMern}`)).canJoin === true, 'reactivated agency → link works again');

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Failures:\n - ' + failures.join('\n - '));
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('\nTEST ABORTED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
