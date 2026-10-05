// Build plan P9 — fresh demo dataset for the /recq candidate flow, created
// through the app's REAL flows (no fake scores):
//   - Portal Admin, agency "Nexora Talent Partners" (/recq/nexora) with owner,
//     recruiter, client company + Company HR, 5 open jobs with different AI
//     interview configs/windows, 2 closed jobs
//   - a second agency "Brightline Staffing" (/recq/brightline) for isolation
//   - 13 fictional candidates who go through resume upload → AI match →
//     email OTP → apply (single job and multi-job discovery)
//   - 4 complete AI interviews run through the real interview engine with
//     AI-role-played answers (strong / average / weak) → transcripts, AI
//     evaluation, interview reports, final scores, then selected (submitted
//     to the Company HR) / rejected
//   - demo-resumes/ for the live part of the demo (not seeded)
//
//   node scripts/seed-recq-demo.mjs           → create (skips if it exists)
//   node scripts/seed-recq-demo.mjs --reset   → remove the demo set, recreate
//   add --yes to allow a non-local DATABASE_URL (never use on production)
//
// Every demo account is on a .demo domain (scripts/lib/recqDemoData.mjs), so
// no real inbox receives anything and --reset removes exactly this set.
// Starts its own API instance on RECQ_SEED_PORT (3094) with email in console
// mode. Password for every account: DEMO_PASSWORD.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { buildDocx, DOCX_MIME } from './lib/testDocx.mjs';
import {
  RECQ_DEMO_DOMAINS,
  ACCOUNTS,
  AGENCY,
  AGENCY_B,
  CLIENT,
  JOBS,
  CLOSED_JOBS,
  AGENCY_B_JOBS,
  CANDIDATES,
  CANDIDATES_B,
  LIVE_RESUMES,
} from './lib/recqDemoData.mjs';
import { CANDIDATES_EXTRA, EXTRA_DAYS_AGO } from './lib/recqDemoExtra.mjs';

const PORT = Number(process.env.RECQ_SEED_PORT || 3094);
const BASE = `http://localhost:${PORT}`;
const PASSWORD = (process.env.DEMO_PASSWORD || 'Demo@123').trim();
// Optional separate password for the Portal Admin (e.g. on a shared/live
// database, where the shared demo password is written in login.md).
const ADMIN_PASSWORD = (process.env.RECQ_ADMIN_PASSWORD || PASSWORD).trim();
const prisma = new PrismaClient();
const step = (t) => console.log(`\n▸ ${t}`);
const info = (t) => console.log(`    ${t}`);
let ipCounter = 10;
const nextIp = () => `10.77.0.${ipCounter++}`;

async function call(p, { method = 'GET', body, token, form, ip } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  if (ip) headers['X-Forwarded-For'] = ip;
  const res = await fetch(`${BASE}/api/v1${p}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const json = await res.json().catch(() => null);
  if (res.status >= 400) {
    const err = new Error(`${method} ${p} -> ${res.status} ${json?.error || ''} ${json?.message || ''}`);
    err.status = res.status;
    err.code = json?.error;
    throw err;
  }
  return json?.data;
}
const tokenOf = (link) => new URL(link).searchParams.get('token');
const setPassword = async (link) => (await call('/auth/set-password', { method: 'POST', body: { token: tokenOf(link), password: PASSWORD } })).token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resumeForm(lines, fileName) {
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(lines)], { type: DOCX_MIME }), fileName);
  return form;
}

// ─── Safety ───
function assertSafeTarget() {
  const url = process.env.DATABASE_URL || '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    /* unparsable — treated as non-local */
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  console.log(`Target database host: ${host || '(unknown)'}${local ? ' (local)' : ''}`);
  if (!local && !process.argv.includes('--yes')) {
    console.error('Refusing to seed a non-local database. Re-run with --yes only for a dedicated demo database (never production).');
    process.exit(1);
  }
}

async function startServer() {
  const code = `import('./src/server/app.js').then(({ createApp }) => createApp().listen(${PORT}, () => console.log('READY')))`;
  const child = spawn(process.execPath, ['-e', code], {
    env: {
      ...process.env,
      FEATURE_RECQ: 'true',
      FEATURE_GUEST_APPLY: 'true',
      FEATURE_INSTANT_INTERVIEW: 'true',
      FEATURE_CLIENT_PORTAL: 'true',
      BREVO_API_KEY: '', // console email: the .demo inboxes don't exist
      EMAIL_PROVIDER: 'console',
      SMS_DRIVER: 'console',
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.env.DEMO_VERBOSE && process.stderr.write(d));
  child.stdout.on('data', (d) => process.env.DEMO_VERBOSE && process.stdout.write(d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('seed server did not start')), 30000);
    child.stdout.on('data', (d) => d.toString().includes('READY') && (clearTimeout(timer), resolve()));
    child.on('exit', (c) => reject(new Error(`seed server exited (${c})`)));
  });
  return child;
}

// ─── Reset: remove exactly the demo set ───
const demoEmailWhere = { OR: RECQ_DEMO_DOMAINS.map((d) => ({ email: { endsWith: `@${d}`, mode: 'insensitive' } })) };

async function removeDemo() {
  const users = await prisma.user.findMany({ where: demoEmailWhere, select: { id: true } });
  const userIds = users.map((u) => u.id);
  // Resume files live in resume_blobs (database storage driver) with no FK —
  // collect their keys first so the blobs don't become orphans.
  const resumes = await prisma.resume.findMany({ where: { candidate: { userId: { in: userIds } } }, select: { storageKey: true } });
  const companies = await prisma.company.deleteMany({ where: { userId: { in: userIds } } }); // cascades jobs → applications → interviews → reports
  const deletedUsers = await prisma.user.deleteMany({ where: { id: { in: userIds } } }); // cascades candidates, resumes, members
  const blobs = await prisma.resumeBlob.deleteMany({ where: { id: { in: resumes.map((r) => r.storageKey) } } });
  const emailOr = RECQ_DEMO_DOMAINS.map((d) => ({ email: { endsWith: `@${d}` } }));
  const otps = await prisma.emailOtp.deleteMany({ where: { OR: emailOr } });
  const logs = await prisma.emailLog.deleteMany({ where: { OR: RECQ_DEMO_DOMAINS.map((d) => ({ recipientEmail: { endsWith: `@${d}` } })) } });
  console.log(
    `Removed the previous demo set: ${companies.count} agencies, ${deletedUsers.count} users, ${blobs.count} resume files, ${otps.count} OTP rows, ${logs.count} email logs.`,
  );
}

// ─── AI role-play of the candidate's spoken answers ───
let callOpenRouter = null;
async function aiAnswer({ candidate, job, question, level }) {
  if (!callOpenRouter) ({ callOpenRouter } = await import('../src/server/ai/openrouter.service.js'));
  const style = {
    strong:
      'You are an excellent, well-prepared candidate. Answer specifically and confidently with concrete examples, numbers and correct technical detail from your resume. 90–140 words.',
    average:
      'You are a middling candidate. Answer only partly: get the basics right but miss important points, stay generic, give no metrics, mix up or skip one detail, and sound unsure ("I think", "maybe"). 40–70 words.',
    weak: 'You are a weak, under-prepared candidate. Give a short, vague answer (15–40 words); be partly wrong or say you have not really done this, even though your resume claims it.',
  }[level];
  const isClosing = question.stage === 'CANDIDATE_QUESTIONS';
  try {
    const out = await callOpenRouter({
      temperature: 0.7,
      systemPrompt:
        `You are role-playing a job candidate named ${candidate.name} in a spoken AI video interview for the role "${job.title}". ` +
        `${style} Speak in first person, natural spoken English (it will be transcribed from speech). ` +
        (isClosing ? 'The interviewer is asking whether you have questions — ask one short relevant question about the team or role (or, if weak, say you have none). ' : '') +
        'Return JSON: {"answer": string}.',
      userPrompt: `Candidate resume:\n${candidate.lines(candidate.name, candidate.email).join('\n')}\n\nInterviewer's question:\n${question.text}`,
    });
    if (out?.answer) return String(out.answer).trim();
  } catch (err) {
    info(`(AI answer failed, using a fallback: ${err.message.slice(0, 80)})`);
  }
  return level === 'weak' ? "I'm not very sure about that, I haven't really worked on it much." : 'In my last project I handled this by breaking the problem down, discussing it with my team and testing the solution carefully.';
}

async function runInterview({ link, candidate, job, level }) {
  const linkToken = link.split('/interview/')[1];
  const { sessionToken, interviewId } = await call(`/public/interviews/${linkToken}/session`, { method: 'POST' });
  const started = await call(`/interviews/${interviewId}/start`, { method: 'POST', token: sessionToken });
  await call(`/interviews/${interviewId}/events`, { method: 'POST', token: sessionToken, body: { type: 'CAMERA_ON' } }).catch(() => {});
  await call(`/interviews/${interviewId}/events`, { method: 'POST', token: sessionToken, body: { type: 'MIC_ON' } }).catch(() => {});
  let question = started.question;
  let turns = 0;
  while (question && turns < 30) {
    turns++;
    const answer = await aiAnswer({ candidate, job, question, level });
    const words = answer.split(/\s+/).length;
    if (level === 'weak' && turns === 3) {
      await call(`/interviews/${interviewId}/events`, { method: 'POST', token: sessionToken, body: { type: 'TAB_SWITCH', metadata: { durationMs: 8400 } } }).catch(() => {});
    }
    const r = await call(`/interviews/${interviewId}/answer`, {
      method: 'POST',
      token: sessionToken,
      body: {
        questionId: question.id,
        transcript: answer,
        rawTranscript: answer,
        durationSeconds: Math.min(question.answerTimeLimitSeconds || 90, Math.round(words / 2.3) + 4),
        sttConfidence: level === 'weak' ? 0.82 : 0.94,
      },
    });
    info(`Q${turns} [${question.stage}] answered (${words} words)`);
    if (r.done) break;
    question = r.question;
  }
  return interviewId;
}

// ─── Candidate goes through /recq ───
async function recqApply(agencySlug, candidate, jobsByKey) {
  const ip = nextIp();
  const lines = candidate.lines(candidate.name, candidate.email);
  const fileName = `${candidate.name.replace(/\s+/g, '_')}_Resume.docx`;
  const wanted = candidate.apply.map((k) => jobsByKey[k].slug);
  let uploadId;
  if (candidate.discover) {
    const d = await call(`/recq/${agencySlug}/match`, { method: 'POST', form: resumeForm(lines, fileName), ip });
    uploadId = d.uploadId;
    info(`discovery: ${d.jobs.map((j) => `${j.title} ${j.score}%${j.pass ? '' : ' (not eligible)'}`).join(' · ')}`);
  } else {
    const m = await call(`/recq/${agencySlug}/jobs/${wanted[0]}/match`, { method: 'POST', form: resumeForm(lines, fileName), ip });
    uploadId = m.uploadId;
    info(`match ${m.job.title}: ${m.match.score}% ${m.match.pass ? '✓' : '✗ below requirement'}`);
  }
  const sent = await call(`/recq/${agencySlug}/otp/send`, { method: 'POST', body: { uploadId, jobSlug: candidate.discover ? undefined : wanted[0] }, ip });
  const { recqToken } = await call(`/recq/${agencySlug}/otp/verify`, { method: 'POST', body: { uploadId, code: sent.devCode }, ip });
  const res = await call(`/recq/${agencySlug}/apply`, { method: 'POST', body: { uploadId, jobSlugs: wanted, recqToken }, ip });
  for (const a of res.applications) info(`→ ${a.jobTitle}: ${a.eligible ? `eligible, interview link issued (${a.matchScore}%)` : `not eligible (${a.matchScore}%)`}`);
  return res.applications;
}

async function seed() {
  step('Portal Admin');
  await prisma.user.create({ data: { email: ACCOUNTS.admin.email, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'ADMIN' } });
  const tAdmin = (await call('/auth/login', { method: 'POST', body: { email: ACCOUNTS.admin.email, password: ADMIN_PASSWORD } })).token;
  // Agencies are onboarded by the Portal Admin (there is no sign-up): the
  // owner gets an invite link and sets a password from it.
  const onboardAgency = async (name, ownerEmail, extra = {}) => {
    const { setupLink } = await call('/admin/companies', { method: 'POST', token: tAdmin, body: { companyName: name, ownerEmail, ...extra } });
    return { token: await setPassword(setupLink) };
  };

  step(`Agency "${AGENCY.name}" (/recq/${AGENCY.slug})`);
  const owner = await onboardAgency(AGENCY.name, ACCOUNTS.owner.email);
  const tOwner = owner.token;
  await call('/companies/careers-link', { method: 'PATCH', token: tOwner, body: { slug: AGENCY.slug } });
  await call('/companies/me', { method: 'PATCH', token: tOwner, body: AGENCY.profile });

  step(`Client company "${CLIENT.name}" + Company HR (portal login)`);
  let { client } = await call('/clients', {
    method: 'POST',
    token: tOwner,
    body: { name: CLIENT.name, industry: CLIENT.industry, website: CLIENT.website, contactName: ACCOUNTS.hr.name, contactEmail: ACCOUNTS.hr.email },
  });
  ({ client } = await call(`/clients/${client.id}/departments`, { method: 'POST', token: tOwner, body: { name: CLIENT.department } }));
  const dept = client.departments[0];
  ({ client } = await call(`/clients/${client.id}/hiring-persons`, {
    method: 'POST',
    token: tOwner,
    body: { fullName: ACCOUNTS.hr.name, email: ACCOUNTS.hr.email, designation: 'Head of Talent Acquisition', departmentId: dept.id },
  }));
  const hr = client.hiringPersons[0];
  await setPassword((await call(`/clients/hiring-persons/${hr.id}/invite`, { method: 'POST', token: tOwner })).setupLink);

  step('Open jobs + AI interview configuration');
  const jobsByKey = {};
  const now = Date.now();
  // Created in reverse so the first job in the list (MERN) is the newest and
  // shows first on /recq (jobs are listed newest first).
  for (const j of [...JOBS].reverse()) {
    const { job } = await call('/jobs', {
      method: 'POST',
      token: tOwner,
      body: {
        title: j.title,
        description: j.description,
        requiredSkills: j.requiredSkills,
        preferredSkills: j.preferredSkills,
        educationRequirements: j.educationRequirements,
        minimumExperience: j.minimumExperience,
        maximumExperience: j.maximumExperience,
        location: j.location,
        workMode: j.workMode,
        employmentType: j.employmentType,
        jobLevel: j.jobLevel,
        openings: j.openings,
        salaryRange: j.salaryRange,
        status: 'OPEN',
        minAcceptableScore: j.minAcceptableScore,
        finalThreshold: j.finalThreshold,
        cvWeight: 0.3,
        interviewWeight: 0.7,
        interviewFlow: 'INSTANT',
        inviteValidDays: 7,
        interviewAvailabilityStart: j.window ? new Date(now + j.window.start).toISOString() : null,
        interviewAvailabilityEnd: j.window ? new Date(now + j.window.end).toISOString() : null,
        ...(j.client ? { clientCompanyId: client.id, departmentId: dept.id, hiringPersonId: hr.id } : {}),
      },
    });
    await call(`/interviews/config/${job.id}`, { method: 'PATCH', token: tOwner, body: j.config });
    jobsByKey[j.key] = job;
    info(`${job.title}  → /recq/${AGENCY.slug}/${job.slug}  (min match ${j.minAcceptableScore}%, ${j.config.questionCount} questions, ${j.config.answerTimeSeconds}s answers)`);
  }

  step('Closed jobs (must never be visible on /recq)');
  for (const j of CLOSED_JOBS) {
    const { job } = await call('/jobs', {
      method: 'POST',
      token: tOwner,
      body: {
        title: j.title,
        description: `Role filled. ${j.title} position working with ${j.requiredSkills.join(', ')} for an enterprise client project.`,
        requiredSkills: j.requiredSkills,
        location: j.location,
        status: 'OPEN',
      },
    });
    await call(`/jobs/${job.id}`, { method: 'DELETE', token: tOwner });
    jobsByKey[j.key] = job;
    info(`${job.title} (CLOSED) — /recq/${AGENCY.slug}/${job.slug} answers 404`);
  }

  step(`Agency recruiter ${ACCOUNTS.recruiter.email}`);
  const inv = await call('/recruiters', {
    method: 'POST',
    token: tOwner,
    body: {
      email: ACCOUNTS.recruiter.email,
      fullName: ACCOUNTS.recruiter.name,
      permissions: ['VIEW_CANDIDATES', 'REVIEW_CANDIDATES', 'CONFIGURE_INTERVIEWS', 'SUBMIT_CANDIDATES', 'MANAGE_JOBS'],
      jobIds: [jobsByKey.mern.id, jobsByKey.backend.id, jobsByKey.react.id],
    },
  });
  await setPassword(inv.setupLink);
  await call(`/clients/${client.id}/recruiters`, { method: 'PUT', token: tOwner, body: { memberIds: [inv.recruiter.id] } });

  step(`Second agency "${AGENCY_B.name}" (/recq/${AGENCY_B.slug})`);
  const ownerB = await onboardAgency(AGENCY_B.name, ACCOUNTS.agencyB.email);
  await call('/companies/careers-link', { method: 'PATCH', token: ownerB.token, body: { slug: AGENCY_B.slug } });
  const jobsB = {};
  for (const j of AGENCY_B_JOBS) {
    const { job } = await call('/jobs', { method: 'POST', token: ownerB.token, body: { ...j, key: undefined, status: 'OPEN', interviewFlow: 'INSTANT' } });
    jobsB[j.key] = job;
    info(`${job.title}  → /recq/${AGENCY_B.slug}/${job.slug}`);
  }

  step('Candidates apply through /recq (resume → AI match → email OTP → apply)');
  const appsByEmail = {};
  for (const c of CANDIDATES) {
    console.log(`  ${c.name}`);
    appsByEmail[c.email] = await recqApply(AGENCY.slug, c, jobsByKey);
  }
  for (const c of CANDIDATES_EXTRA) {
    console.log(`  ${c.name}`);
    appsByEmail[c.email] = await recqApply(AGENCY.slug, c, jobsByKey);
  }
  for (const c of CANDIDATES_B) {
    console.log(`  ${c.name} (Brightline)`);
    appsByEmail[c.email] = await recqApply(AGENCY_B.slug, c, jobsB);
  }

  step('AI interviews through the real interview engine');
  const interviewed = [];
  for (const c of CANDIDATES.filter((x) => x.interview)) {
    const job = jobsByKey[c.interview.job];
    const app = appsByEmail[c.email].find((a) => a.jobSlug === job.slug);
    if (!app?.interview?.link) {
      info(`${c.name}: no interview link for ${job.title} (not eligible) — skipped`);
      continue;
    }
    console.log(`  ${c.name} — ${job.title} (${c.interview.level} answers)`);
    const interviewId = await runInterview({ link: app.interview.link, candidate: c, job, level: c.interview.level });
    const row = await prisma.interview.findUnique({ where: { id: interviewId }, include: { report: true, application: true } });
    info(
      `report: ${row.report?.status} · interview ${row.report?.overallScore ?? '—'} · final ${row.application.finalScore ?? '—'} · status ${row.application.status}`,
    );
    interviewed.push({ c, job, applicationId: row.applicationId });
  }

  step('Recruiter screening mode 2 (re-evaluate interviewed candidates)');
  for (const key of ['mern', 'backend', 'react']) {
    const r = await call(`/screening/job/${jobsByKey[key].id}/run-final`, { method: 'POST', token: tOwner });
    info(`${jobsByKey[key].title}: ${r.evaluatedCount}/${r.candidateCount} re-evaluated`);
  }

  step('Final decisions');
  for (const { c, applicationId } of interviewed) {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (c.after === 'submit' && ['QUALIFIED', 'INTERVIEW_COMPLETED'].includes(app.status)) {
      await call('/submissions', {
        method: 'POST',
        token: tOwner,
        body: { applicationId, hiringPersonId: hr.id, note: 'Strong MERN profile — excellent interview. Recommended for the final round.' },
      });
      info(`${c.name}: selected → submitted to ${ACCOUNTS.hr.name} (${CLIENT.name})`);
    } else if (c.after === 'reject') {
      await call(`/applications/${applicationId}/reject`, { method: 'PATCH', token: tOwner });
      info(`${c.name}: rejected (final score ${app.finalScore ?? '—'})`);
    } else {
      info(`${c.name}: ${app.status} (final score ${app.finalScore ?? '—'})`);
    }
  }

  await realisticTimeline();

  writeSampleResumes();
}

// Resumes for the live part of the demo (never seeded): demo-resumes/ for a
// local recording, and public/sample-resumes/ so /live-demo can offer them
// as downloads (fictional people, .demo emails).
function writeSampleResumes() {
  step('Live-demo resumes (not seeded)');
  for (const dir of [path.resolve('demo-resumes'), path.resolve('public', 'sample-resumes')]) {
    fs.mkdirSync(dir, { recursive: true });
    for (const r of LIVE_RESUMES) fs.writeFileSync(path.join(dir, r.file), buildDocx(r.lines(r.name, r.email)));
  }
  info(`demo-resumes/ and public/sample-resumes/: ${LIVE_RESUMES.map((r) => r.file).join(', ')}`);
}

// The seed runs every step within minutes, which would show 1-minute
// interviews all taken "just now". Spread the demo set over the past week
// instead: each candidate applied N days ago during working hours, and each
// completed interview took place the next day, with its duration derived
// from the answers actually recorded (answer time + interviewer speaking
// time). Only timestamps of these demo rows change — never scores or content.
const DAYS_AGO = {
  'priya.sharma@mail.demo': 6,
  'arjun.verma@mail.demo': 6,
  'sneha.kulkarni@mail.demo': 5,
  'karan.malhotra@mail.demo': 5,
  'neha.gupta@mail.demo': 4,
  'ananya.iyer@mail.demo': 3,
  'vikram.joshi@mail.demo': 3,
  'siddharth.menon@mail.demo': 3,
  'meera.nair@mail.demo': 2,
  'rohit.patil@mail.demo': 2,
  'fatima.sheikh@mail.demo': 2,
  'ishita.banerjee@mail.demo': 1,
  'rahul.deshmukh@mail.demo': 1,
};

async function realisticTimeline(daysAgo = { ...DAYS_AGO, ...EXTRA_DAYS_AGO }) {
  step('Realistic timeline (applications over the past week, interviews the next day)');
  const now = Date.now();
  const at = (base, sec) => new Date(base.getTime() + sec * 1000);
  let k = 0;
  for (const [email, days] of Object.entries(daysAgo)) {
    k++;
    const applied = new Date(now);
    applied.setDate(applied.getDate() - days);
    applied.setHours(9 + (k % 8), (k * 13) % 60, 0, 0);
    if (applied.getTime() > now - 3600 * 1000) applied.setTime(now - (2 + k) * 3600 * 1000); // "today" stays in the past
    const user = await prisma.user.findUnique({ where: { email }, include: { candidate: true } });
    if (!user?.candidate) continue;
    await prisma.user.update({ where: { id: user.id }, data: { createdAt: applied } });
    await prisma.candidate.update({ where: { id: user.candidate.id }, data: { createdAt: applied } });
    await prisma.resume.updateMany({ where: { candidateId: user.candidate.id }, data: { createdAt: applied } });
    const apps = await prisma.application.findMany({
      where: { candidateId: user.candidate.id },
      include: {
        interviews: { include: { questions: { include: { answer: true }, orderBy: { askedAt: 'asc' } }, events: { orderBy: { occurredAt: 'asc' } } } },
      },
    });
    for (const app of apps) {
      await prisma.application.update({ where: { id: app.id }, data: { createdAt: applied } });
      await prisma.screeningResult.updateMany({ where: { applicationId: app.id }, data: { createdAt: at(applied, 40), screenedAt: at(applied, 40) } });
      for (const iv of app.interviews) {
        if (iv.status !== 'COMPLETED') {
          await prisma.interview.update({ where: { id: iv.id }, data: { createdAt: at(applied, 75) } });
          continue;
        }
        const start = new Date(applied);
        start.setDate(start.getDate() + 1);
        start.setHours(11 + (k % 6), 10 + ((k * 7) % 40), 0, 0);
        if (start.getTime() > now - 3 * 3600 * 1000) start.setTime(now - 3 * 3600 * 1000);
        let t = at(start, 20); // joined, camera on, first question loading
        for (const q of iv.questions) {
          await prisma.interviewQuestion.update({ where: { id: q.id }, data: { askedAt: t } });
          const speak = Math.round(q.text.split(/\s+/).length / 2.6) + 3; // interviewer speaking
          if (q.answer) {
            const answered = at(t, speak + (q.answer.durationSeconds || 45));
            await prisma.interviewAnswer.update({ where: { id: q.answer.id }, data: { answeredAt: answered } });
            t = at(answered, 6); // evaluating + next question
          } else t = at(t, speak);
        }
        const ended = t;
        const mid = at(start, (ended - start) / 2000);
        const eventTime = { INTERVIEW_STARTED: start, CAMERA_ON: at(start, 4), MIC_ON: at(start, 30), MIC_OFF: at(ended, -8), TAB_SWITCH: mid, INTERVIEW_ENDED: ended };
        for (const e of iv.events) {
          await prisma.interviewEvent.update({ where: { id: e.id }, data: { occurredAt: eventTime[e.type] || mid } });
        }
        await prisma.interview.update({ where: { id: iv.id }, data: { createdAt: at(applied, 75), startedAt: start, endedAt: ended } });
        await prisma.interviewReport.updateMany({ where: { interviewId: iv.id }, data: { createdAt: at(ended, 5), generatedAt: at(ended, 25) } });
        await prisma.application.update({ where: { id: app.id }, data: { finalScoredAt: at(ended, 30) } });
        await prisma.clientSubmission.updateMany({ where: { applicationId: app.id }, data: { createdAt: at(ended, 5 * 3600) } });
        info(`${user.candidate.fullName}: applied ${applied.toLocaleDateString()} · interview ${Math.round((ended - start) / 60000)} min on ${start.toLocaleDateString()}`);
      }
    }
  }
}

// --extra: add only the extra applicants to an existing demo set.
async function addExtraCandidates() {
  const agency = await prisma.company.findUnique({ where: { slug: AGENCY.slug }, include: { jobs: true } });
  if (!agency) {
    console.error('The demo agency does not exist yet — run the full seed first.');
    process.exitCode = 1;
    return;
  }
  const jobsByKey = Object.fromEntries(
    [...JOBS, ...CLOSED_JOBS].map((j) => [j.key, agency.jobs.find((x) => x.title === j.title)]).filter(([, job]) => job),
  );
  const todo = [];
  for (const c of CANDIDATES_EXTRA) {
    if (await prisma.user.findUnique({ where: { email: c.email } })) console.log(`  ${c.name}: already in the demo set — skipped`);
    else todo.push(c);
  }
  if (!todo.length) return console.log('All extra candidates are already there.');
  const server = await startServer();
  try {
    step(`Extra candidates apply through /recq (${todo.length})`);
    for (const c of todo) {
      console.log(`  ${c.name}`);
      await recqApply(AGENCY.slug, c, jobsByKey);
    }
    await realisticTimeline(Object.fromEntries(todo.map((c) => [c.email, EXTRA_DAYS_AGO[c.email] ?? 1])));
  } finally {
    server.kill();
  }
  console.log(`\nAdded ${todo.length} candidates to ${AGENCY.name}.`);
}

async function main() {
  assertSafeTarget();
  if (process.argv.includes('--extra')) return addExtraCandidates();
  const reset = process.argv.includes('--reset');
  const existing = await prisma.user.findUnique({ where: { email: ACCOUNTS.owner.email } });
  if (existing && !reset) {
    console.log('The RecQ demo set already exists. Run with --reset to recreate it.');
    return;
  }
  if (reset) await removeDemo();
  const server = await startServer();
  const t0 = Date.now();
  try {
    await seed();
  } finally {
    server.kill();
  }
  console.log(`\nRecQ demo ready in ${Math.round((Date.now() - t0) / 1000)}s. Password for every account: the DEMO_PASSWORD value.`);
  for (const [k, a] of Object.entries(ACCOUNTS)) console.log(`  ${k.padEnd(10)} ${a.email}`);
  console.log(`  Candidate links: /recq/${AGENCY.slug}  ·  /recq/${AGENCY_B.slug}`);
}

main()
  .catch((err) => {
    console.error('RECQ DEMO SEED FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
