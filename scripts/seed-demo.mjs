// Creates the "Start here" demo set (see src/shared/constants/demo.js) through
// the app's real flows: Portal Admin, demo agency + careers link, a company
// with an Engineering department and its Company HR (portal login), an
// agency recruiter, an open job, a candidate (profile + CV, not applied yet,
// so the demo can apply live) and one sample candidate already submitted to
// the Company HR so their portal isn't empty.
//
//   node scripts/seed-demo.mjs           → create (skips if it already exists)
//   node scripts/seed-demo.mjs --reset   → delete the demo set first, then create
//
// Starts its own API on port 3093 with the needed features on and email in
// console mode (the .demo addresses have no inbox). Writes to the database in
// DATABASE_URL — back it up first (node scripts/backup-db.mjs before-demo).
import 'dotenv/config';
import { spawn } from 'child_process';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { buildDocx, reactResumeLines, DOCX_MIME } from './lib/testDocx.mjs';
import {
  DEMO_ACCOUNTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_AGENCY_NAME,
  DEMO_AGENCY_SLUG,
  DEMO_COMPANY_NAME,
  DEMO_JOB_TITLE,
} from '../src/shared/constants/demo.js';

const PORT = Number(process.env.DEMO_SEED_PORT || 3093);
const BASE = `http://localhost:${PORT}`;
const PASSWORD = (process.env.DEMO_PASSWORD || 'Demo@123').trim();
const SAMPLE_EMAIL = `sample.candidate@${DEMO_EMAIL_DOMAIN}`;
const prisma = new PrismaClient();
const acct = Object.fromEntries(DEMO_ACCOUNTS.map((a) => [a.key, a]));

async function call(path, { method = 'GET', body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const json = await res.json().catch(() => null);
  if (res.status >= 400) throw new Error(`${method} ${path} -> ${res.status} ${json?.message || ''}`);
  return json?.data;
}
const tokenOf = (link) => new URL(link).searchParams.get('token');
const setPassword = async (link) => (await call('/auth/set-password', { method: 'POST', body: { token: tokenOf(link), password: PASSWORD } })).token;
const step = (t) => console.log(`- ${t}`);

async function startServer() {
  const code = `import('./src/server/app.js').then(({ createApp }) => createApp().listen(${PORT}, () => console.log('READY')))`;
  const child = spawn(process.execPath, ['-e', code], {
    env: {
      ...process.env,
      FEATURE_GUEST_APPLY: 'true',
      FEATURE_INSTANT_INTERVIEW: 'true',
      FEATURE_CLIENT_PORTAL: 'true',
      BREVO_API_KEY: '', // console email: the .demo inboxes don't exist
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.env.DEMO_VERBOSE && process.stderr.write(d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('seed server did not start')), 30000);
    child.stdout.on('data', (d) => d.toString().includes('READY') && (clearTimeout(timer), resolve()));
    child.on('exit', (c) => reject(new Error(`seed server exited (${c})`)));
  });
  return child;
}

async function removeDemo() {
  const where = { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}`, mode: 'insensitive' } };
  const companies = await prisma.company.deleteMany({ where: { user: where } });
  const users = await prisma.user.deleteMany({ where });
  console.log(`Removed the old demo set (${companies.count} agency, ${users.count} users).`);
}

async function uploadCv(token, name, email) {
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines(name, email, '+919800000000'))], { type: DOCX_MIME }), 'cv.docx');
  return (await call('/resumes', { method: 'POST', token, form })).resume;
}

async function seed() {
  step('Portal Admin');
  await prisma.user.create({
    data: { email: acct.admin.email, passwordHash: await bcrypt.hash(PASSWORD, 10), role: 'ADMIN' },
  });

  step('Agency + careers link');
  const owner = await call('/auth/register/company', {
    method: 'POST',
    body: { email: acct.agency.email, password: PASSWORD, companyName: DEMO_AGENCY_NAME },
  });
  const tOwner = owner.token;
  await call('/companies/careers-link', { method: 'PATCH', token: tOwner, body: { slug: DEMO_AGENCY_SLUG } });

  step('Company, department and Company HR (portal login)');
  let { client } = await call('/clients', {
    method: 'POST',
    token: tOwner,
    body: { name: DEMO_COMPANY_NAME, industry: 'Software', contactName: acct.hr.fullName, contactEmail: acct.hr.email, website: 'https://example.com' },
  });
  ({ client } = await call(`/clients/${client.id}/departments`, { method: 'POST', token: tOwner, body: { name: 'Engineering' } }));
  const dept = client.departments[0];
  // Department set on purpose: older deployed code expects HR to have one.
  ({ client } = await call(`/clients/${client.id}/hiring-persons`, {
    method: 'POST',
    token: tOwner,
    body: { fullName: acct.hr.fullName, email: acct.hr.email, designation: 'HR Manager', departmentId: dept.id },
  }));
  const hr = client.hiringPersons[0];
  const hrInvite = await call(`/clients/hiring-persons/${hr.id}/invite`, { method: 'POST', token: tOwner });
  await setPassword(hrInvite.setupLink);

  step('Open job (instant AI interview link)');
  const { job } = await call('/jobs', {
    method: 'POST',
    token: tOwner,
    body: {
      title: DEMO_JOB_TITLE,
      description:
        'Build and maintain React front-ends with JavaScript, HTML and CSS, working with REST APIs. ' +
        'You will collaborate with designers and backend engineers, write clean reusable components and keep pages fast and accessible.',
      minimumExperience: 1,
      maximumExperience: 5,
      requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS'],
      preferredSkills: ['REST APIs', 'Git'],
      location: 'Pune',
      workMode: 'Hybrid',
      status: 'OPEN',
      interviewFlow: 'INSTANT',
      finalThreshold: 70,
      clientCompanyId: client.id,
      departmentId: dept.id,
      hiringPersonId: hr.id,
    },
  });

  step('Agency recruiter (assigned to the job and the company)');
  const inv = await call('/recruiters', {
    method: 'POST',
    token: tOwner,
    body: {
      email: acct.recruiter.email,
      fullName: acct.recruiter.fullName,
      permissions: ['REVIEW_CANDIDATES', 'CONFIGURE_INTERVIEWS', 'MANAGE_CLIENTS'],
      jobIds: [job.id],
    },
  });
  await setPassword(inv.setupLink);
  await call(`/clients/${client.id}/recruiters`, { method: 'PUT', token: tOwner, body: { memberIds: [inv.recruiter.id] } });

  step('Candidate (profile + CV, not applied — apply live in the demo)');
  const cand = await call('/auth/register/candidate', {
    method: 'POST',
    body: { email: acct.candidate.email, password: PASSWORD, fullName: acct.candidate.fullName },
  });
  await uploadCv(cand.token, acct.candidate.fullName, acct.candidate.email);

  step('Sample candidate already sent to Company HR');
  const sample = await call('/auth/register/candidate', {
    method: 'POST',
    body: { email: SAMPLE_EMAIL, password: PASSWORD, fullName: 'Priya Sample' },
  });
  const resume = await uploadCv(sample.token, 'Priya Sample', SAMPLE_EMAIL);
  const { application } = await call('/applications', { method: 'POST', token: sample.token, body: { jobId: job.id, resumeId: resume.id } });
  try {
    await call(`/screening/application/${application.id}/run`, { method: 'POST', token: tOwner });
  } catch (err) {
    console.warn(`  (AI screening skipped: ${err.message})`);
  }
  // No real interview is run for the sample; it is marked as interviewed so
  // it can be submitted and shows up in the Company HR portal.
  await prisma.application.update({ where: { id: application.id }, data: { status: 'INTERVIEW_COMPLETED', finalScore: 82 } });
  await call('/submissions', { method: 'POST', token: tOwner, body: { applicationId: application.id, hiringPersonId: hr.id } });
}

async function main() {
  const reset = process.argv.includes('--reset');
  const existing = await prisma.user.findUnique({ where: { email: acct.agency.email } });
  if (existing && !reset) {
    console.log('The demo set already exists. Run with --reset to recreate it.');
    return;
  }
  if (reset) await removeDemo();
  const server = await startServer();
  try {
    await seed();
  } finally {
    server.kill();
  }
  console.log(`\nDemo ready. Password for every account: ${PASSWORD}`);
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.label.padEnd(17)} ${a.email}`);
  console.log(`  Careers page      /careers/${DEMO_AGENCY_SLUG}`);
  console.log('Turn DEMO_PAGE=true on to show these on /start.');
}

main()
  .catch((err) => {
    console.error('DEMO SEED FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
