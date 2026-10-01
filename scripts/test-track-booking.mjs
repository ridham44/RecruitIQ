// Candidate without login: status link → progress → book / change a slot →
// join link; plus "manual shortlist on an INSTANT job emails the interview
// link" and the status link in candidate emails.
//
// Starts its own API on port 3091 (guest apply + instant interview on,
// console email/SMS) and stops it at the end:
//   node scripts/test-track-booking.mjs
import 'dotenv/config';
import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { buildDocx, reactResumeLines, DOCX_MIME } from './lib/testDocx.mjs';

const PORT = Number(process.env.TRACK_TEST_PORT || 3091);
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
const tokenFromLink = (link) => link.split('/interview/')[1];

async function startServer() {
  const code = `import('./src/server/app.js').then(({ createApp }) => createApp().listen(${PORT}, () => console.log('READY')))`;
  const child = spawn(process.execPath, ['-e', code], {
    env: { ...process.env, FEATURE_GUEST_APPLY: 'true', FEATURE_INSTANT_INTERVIEW: 'true', SMS_DRIVER: 'console', BREVO_API_KEY: '', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.env.TRACK_VERBOSE && process.stderr.write(d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test server did not start')), 30000);
    child.stdout.on('data', (d) => d.toString().includes('READY') && (clearTimeout(timer), resolve()));
    child.on('exit', (c) => reject(new Error(`test server exited (${c})`)));
  });
  return child;
}

async function guestApply(slug, jobId, label, phone) {
  const email = `track-${label}-${ts}@test.com`;
  const sent = await req('/public/otp/send', { method: 'POST', body: { phone } });
  const { otpToken } = await req('/public/otp/verify', { method: 'POST', body: { phone, code: sent.devCode } });
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines(`Track ${label}`, email, phone))], { type: DOCX_MIME }), 'cv.docx');
  const { uploadId } = await req('/public/cv/parse', { method: 'POST', form });
  const applied = await req('/public/applications', {
    method: 'POST',
    body: { slug, uploadId, jobId, fullName: `Track ${label}`, email, phone, otpToken, consent: true },
  });
  return { ...applied, email };
}

const emailsTo = (to, type) => prisma.emailLog.findMany({ where: { recipientEmail: to, ...(type ? { type } : {}) }, orderBy: { sentAt: 'asc' } });

async function main() {
  step('0. Agency, SLOT job with 3 future slots, INSTANT job');
  const owner = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `track-owner-${ts}@test.com`, password: PASSWORD, companyName: `Track Agency ${ts}` },
  });
  const tO = owner.token;
  const { slug } = await req('/companies/careers-link', { token: tO });
  const desc = 'Build React front-ends with JavaScript, HTML and CSS against REST APIs.';
  const { job: slotJob } = await req('/jobs', { method: 'POST', token: tO, body: { title: `Track Slot Job ${ts}`, description: desc, status: 'OPEN' } });
  const { job: instantJob } = await req('/jobs', {
    method: 'POST',
    token: tO,
    body: { title: `Track Instant Job ${ts}`, description: desc, status: 'OPEN', interviewFlow: 'INSTANT' },
  });
  const hour = 3600 * 1000;
  const base = Date.now() + 24 * hour;
  await req(`/scheduling/jobs/${slotJob.id}/slots`, {
    method: 'POST',
    token: tO,
    body: { slots: [0, 1, 2].map((i) => ({ startTime: new Date(base + i * hour), endTime: new Date(base + i * hour + 30 * 60 * 1000) })) },
  });
  const slotsInDb = await prisma.interviewSlot.findMany({ where: { jobId: slotJob.id }, orderBy: { startTime: 'asc' } });
  assert(slotsInDb.length === 3, 'three slots published');

  step('1. Guest applies → status link works without login');
  const g = await guestApply(slug, slotJob.id, 'slot', `+9198${String(ts).slice(-8)}`);
  const T = g.trackingToken;
  const received = await emailsTo(g.email, 'ACCOUNT_SETUP');
  assert(received.length === 1, 'application-received email sent (it carries the status link)');
  let st = await req(`/public/track?token=${encodeURIComponent(T)}`);
  assert(st.kind === 'application' && st.usesSlots === true && st.hasBookedSlot === false, 'status says: slot-booking job, nothing booked');
  let b = await req(`/public/track/booking?token=${encodeURIComponent(T)}`);
  assert(b.usesSlots && !b.canBook && b.slots.length === 0 && !b.booked, 'before shortlisting: no booking offered');
  const early = await call('/public/track/booking', { method: 'POST', body: { token: T, slotId: slotsInDb[0].id } });
  assert(early.status === 400 && early.json?.error === 'NOT_SHORTLISTED', 'booking before shortlist → 400 NOT_SHORTLISTED');

  step('2. Manual shortlist (SLOT job) → shortlist email with the booking link');
  await req(`/applications/job/${slotJob.id}/bulk-status`, { method: 'PATCH', token: tO, body: { applicationIds: [g.id], status: 'SHORTLISTED' } });
  const shortlisted = await emailsTo(g.email, 'APPLICATION_SHORTLISTED');
  assert(shortlisted.length === 1, 'shortlist email sent (with "Book your interview time")');
  st = await req(`/public/track?token=${encodeURIComponent(T)}`);
  assert(st.stage === 'shortlisted', 'status page: Shortlisted');
  b = await req(`/public/track/booking?token=${encodeURIComponent(T)}`);
  assert(b.canBook && b.slots.length === 3 && !b.booked, 'the 3 open slots are offered');

  step('3. Book a slot from the link');
  const bad = await call('/public/track/booking', { method: 'POST', body: { token: T, slotId: 'nope' } });
  assert(bad.status === 404, 'unknown slot → 404');
  b = await req('/public/track/booking', { method: 'POST', body: { token: T, slotId: slotsInDb[0].id } });
  assert(b.booked && new Date(b.booked.startTime).getTime() === slotsInDb[0].startTime.getTime() && b.booked.joinLink, 'booked, with a join link');
  assert(b.canChange === true && b.canBook === false, 'can change time, cannot book a second one');
  const s0 = await prisma.interviewSlot.findUnique({ where: { id: slotsInDb[0].id } });
  assert(s0.status === 'BOOKED', 'slot is BOOKED');
  st = await req(`/public/track?token=${encodeURIComponent(T)}`);
  assert(st.stage === 'interview_scheduled' && st.hasBookedSlot === true, 'status page: Interview booked');
  const confirm = await emailsTo(g.email, 'INTERVIEW_CONFIRMATION');
  assert(confirm.length === 1, 'confirmation email sent (with the join link)');
  const again = await call('/public/track/booking', { method: 'POST', body: { token: T, slotId: slotsInDb[1].id } });
  assert(again.status === 400, 'a second booking is refused');

  step('4. Join link opens the interview without login');
  const joinToken = tokenFromLink(b.booked.joinLink);
  const info = await req(`/public/interviews/${joinToken}`);
  assert(info.canJoin && info.slot && new Date(info.slot.startTime).getTime() === slotsInDb[0].startTime.getTime(), 'join page shows the booked time and can join');
  const sess = await req(`/public/interviews/${joinToken}/session`, { method: 'POST' });
  assert(sess.sessionToken && sess.interviewId === b.booked.interviewId, 'join link → interview session');
  const own = await call(`/interviews/${sess.interviewId}`, { token: sess.sessionToken });
  assert(own.status === 200, 'the session opens this interview');
  const other = await call('/applications/mine', { token: sess.sessionToken });
  assert(other.status === 401 || other.status === 403, 'but nothing else in the account');

  step('5. Change the time');
  b = await req('/public/track/booking/cancel', { method: 'POST', body: { token: T } });
  assert(b.canBook && !b.booked && b.slots.length === 3, 'after "Change time" all 3 slots are open again');
  const s0b = await prisma.interviewSlot.findUnique({ where: { id: slotsInDb[0].id } });
  assert(s0b.status === 'AVAILABLE', 'old slot freed');
  const oldLink = await call(`/public/interviews/${joinToken}`);
  assert(oldLink.status === 200 && oldLink.data?.canJoin === false, 'old join link no longer opens an interview');
  b = await req('/public/track/booking', { method: 'POST', body: { token: T, slotId: slotsInDb[2].id } });
  assert(b.booked && new Date(b.booked.startTime).getTime() === slotsInDb[2].startTime.getTime(), 're-booked another slot');
  assert(tokenFromLink(b.booked.joinLink) !== joinToken, 'with a new join link');

  step('6. Security');
  const forged = await call('/public/track/booking?token=not-a-token');
  assert(forged.status === 404 && forged.json?.error === 'TRACK_TOKEN_INVALID', 'invalid status link → 404');
  const g2 = await guestApply(slug, slotJob.id, 'other', `+9197${String(ts).slice(-8)}`);
  const otherBook = await call('/public/track/booking', { method: 'POST', body: { token: g2.trackingToken, slotId: slotsInDb[2].id } });
  assert(otherBook.status === 400, "another candidate's link can't take that slot (not shortlisted)");
  await req(`/applications/job/${slotJob.id}/bulk-status`, { method: 'PATCH', token: tO, body: { applicationIds: [g2.id], status: 'SHORTLISTED' } });
  const taken = await call('/public/track/booking', { method: 'POST', body: { token: g2.trackingToken, slotId: slotsInDb[2].id } });
  assert(taken.status === 409 && taken.json?.error === 'SLOT_UNAVAILABLE', 'an already-booked slot → 409');
  const race = await Promise.all([
    call('/public/track/booking', { method: 'POST', body: { token: g2.trackingToken, slotId: slotsInDb[0].id } }),
    call('/public/track/booking', { method: 'POST', body: { token: g2.trackingToken, slotId: slotsInDb[1].id } }),
  ]);
  const okCount = race.filter((r) => r.status === 200).length;
  const active = await prisma.interview.count({ where: { applicationId: g2.id, status: 'SCHEDULED' } });
  assert(okCount === 1 && active === 1, 'double click books only one slot');

  step('7. Manual shortlist on an INSTANT job emails the interview link');
  const g3 = await guestApply(slug, instantJob.id, 'instant', `+9196${String(ts).slice(-8)}`);
  await req(`/applications/job/${instantJob.id}/bulk-status`, { method: 'PATCH', token: tO, body: { applicationIds: [g3.id], status: 'SHORTLISTED' } });
  const invite = await emailsTo(g3.email, 'INTERVIEW_INVITE');
  const plain = await emailsTo(g3.email, 'APPLICATION_SHORTLISTED');
  assert(invite.length === 1 && plain.length === 0, 'interview-link email instead of the plain shortlist email');
  const app3 = await prisma.application.findUnique({ where: { id: g3.id } });
  assert(app3.status === 'INTERVIEW_SCHEDULED', 'instant interview created');
  const st3 = await req(`/public/track?token=${encodeURIComponent(g3.trackingToken)}`);
  assert(st3.usesSlots === false && st3.interview?.link, 'status page shows Start interview, no slot booking');
  const b3 = await req(`/public/track/booking?token=${encodeURIComponent(g3.trackingToken)}`);
  assert(!b3.usesSlots && !b3.canBook, 'booking endpoint offers nothing for INSTANT jobs');
  const instantBook = await call('/public/track/booking', { method: 'POST', body: { token: g3.trackingToken, slotId: slotsInDb[1].id } });
  assert(instantBook.status === 400 || instantBook.status === 404, 'and refuses a slot');

  console.log(`\nTRACK-BOOKING TESTS PASSED ✔  (${passed} checks)`);
}

let server;
startServer()
  .then((s) => {
    server = s;
    return main();
  })
  .catch((err) => {
    console.error(`\nTRACK-BOOKING TEST FAILED after ${passed} passing checks:`, err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    server?.kill();
    await prisma.$disconnect();
  });
