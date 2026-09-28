// Telephonic AI interview test. Drives the whole phone flow through the real
// API by playing phone-agent/'s role (dialer + voice agent) against the
// worker-secret endpoints — everything except the literal Twilio call and
// speech audio, which need a real phone:
//   company creates PHONE slots -> candidate books with a phone number ->
//   dialer finds it due, claims it (atomic), no-answer retry, "Call now",
//   agent starts it on pickup, line drops + redial resumes, full interview
//   via /worker/answer, same final report as online, retry exhaustion, and
//   an ONLINE regression check.
//
// Usage: npm run dev:server   (other terminal)
//        node scripts/test-phone-interview.mjs path/to/resume.docx
import 'dotenv/config';
import { readFileSync } from 'fs';

const BASE = process.env.TEST_API_BASE || 'http://localhost:3001/api/v1';
const WORKER_SECRET = process.env.INTERVIEW_WORKER_SECRET || 'dev-local-interview-worker-secret-change-me';
const ts = Date.now();

async function call(path, { method = 'GET', body, token, worker = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (worker) headers['x-worker-secret'] = WORKER_SECRET;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function req(path, opts) {
  const { status, json } = await call(path, opts);
  if (status >= 400) {
    console.error(`FAIL ${opts?.method || 'GET'} ${path} ->`, status, json);
    throw new Error(json?.message || `HTTP ${status}`);
  }
  return json.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ok:', msg);
}

const docxPath = process.argv[2];
if (!docxPath) throw new Error('Usage: node scripts/test-phone-interview.mjs <path-to-resume.docx>');
const docxBuffer = readFileSync(docxPath);

async function newShortlistedCandidate(label, jobId, companyToken) {
  const { token } = await req('/auth/register/candidate', {
    method: 'POST',
    body: { email: `phone-${label}-${ts}@test.com`, password: 'password123', fullName: `${label} Candidate` },
  });
  const form = new FormData();
  form.append('resume', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'resume.docx');
  const uploadRes = await fetch(`${BASE}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const { resume } = (await uploadRes.json()).data;
  const { application } = await req('/applications', { method: 'POST', token, body: { jobId, resumeId: resume.id } });
  await req(`/applications/job/${jobId}/bulk-status`, {
    method: 'PATCH',
    token: companyToken,
    body: { applicationIds: [application.id], status: 'SHORTLISTED' },
  });
  return { token, application };
}

const isDue = async (interviewId) =>
  (await req('/interviews/worker/phone-interviews/due?limit=50', { worker: true })).interviews.some((i) => i.id === interviewId);

console.log('== Setup: company, job, AI interviewer ==');
const { token: companyToken } = await req('/auth/register/company', {
  method: 'POST',
  body: { email: `phone-company-${ts}@test.com`, password: 'password123', companyName: 'Phone Test Co' },
});
const { job } = await req('/jobs', {
  method: 'POST',
  token: companyToken,
  body: {
    title: 'React Developer',
    description: 'React developer role. Requires React, JavaScript, and REST API experience.',
    requiredSkills: ['React', 'JavaScript', 'REST API'],
    status: 'OPEN',
  },
});
await req(`/interviews/config/${job.id}`, {
  method: 'PATCH',
  token: companyToken,
  body: { aiName: 'Priya', aiTitle: 'Virtual HR', questionCount: 4, answerTimeSeconds: 30, customQuestions: [] },
});

console.log('\n== Company creates slots: mode chosen per slot ==');
const rangeStart = new Date(Date.now() - 5 * 60 * 1000); // already started -> due right away
const { slots: phoneSlots } = await req(`/scheduling/jobs/${job.id}/slots/generate`, {
  method: 'POST',
  token: companyToken,
  body: { rangeStart: rangeStart.toISOString(), rangeEnd: new Date(rangeStart.getTime() + 45 * 60 * 1000).toISOString(), durationMinutes: 15, mode: 'PHONE' },
});
assert(phoneSlots.length === 3 && phoneSlots.every((s) => s.mode === 'PHONE'), 'generated 3 PHONE slots');
const onlineStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
const { slots: onlineSlots } = await req(`/scheduling/jobs/${job.id}/slots`, {
  method: 'POST',
  token: companyToken,
  body: { slots: [{ startTime: onlineStart.toISOString(), endTime: new Date(onlineStart.getTime() + 15 * 60 * 1000).toISOString() }] },
});
assert(onlineSlots[0].mode === 'ONLINE', 'a slot created without mode defaults to ONLINE (existing behavior)');

console.log('\n== Candidate books a PHONE slot ==');
const main = await newShortlistedCandidate('main', job.id, companyToken);
let res = await call(`/scheduling/applications/${main.application.id}/book`, { method: 'POST', token: main.token, body: { slotId: phoneSlots[0].id } });
assert(res.status === 400 && res.json.error === 'PHONE_NUMBER_REQUIRED', 'PHONE slot without a phone number is rejected');
const { slots: afterReject } = await req(`/scheduling/applications/${main.application.id}/slots`, { token: main.token });
assert(afterReject.find((s) => s.id === phoneSlots[0].id).status === 'AVAILABLE', 'rejected booking left the slot AVAILABLE');
res = await call(`/scheduling/applications/${main.application.id}/book`, { method: 'POST', token: main.token, body: { slotId: phoneSlots[0].id, phoneNumber: '98765' } });
assert(res.status === 400, 'an invalid phone number is rejected');
const { interview: booked } = await req(`/scheduling/applications/${main.application.id}/book`, {
  method: 'POST',
  token: main.token,
  body: { slotId: phoneSlots[0].id, phoneNumber: '+91 98765-43210' },
});
const interviewId = booked.id;
assert(booked.mode === 'PHONE' && booked.phoneNumber === '+919876543210', 'booked as PHONE, number normalized to E.164');
assert(booked.callStatus === 'PENDING' && booked.status === 'SCHEDULED', 'call PENDING, interview SCHEDULED');

res = await call(`/interviews/${interviewId}/start`, { method: 'POST', token: main.token });
assert(res.status === 400 && res.json.error === 'PHONE_INTERVIEW', 'browser room join is blocked for a telephonic interview');

console.log('\n== Dialer: due -> claim (atomic) -> no answer -> retry scheduled ==');
assert(await isDue(interviewId), 'interview is due (slot has started)');
const { interview: claimed } = await req(`/interviews/${interviewId}/worker/claim`, { method: 'POST', worker: true });
assert(claimed.phoneNumber === '+919876543210' && claimed.callAttempts === 1, 'claimed with the number to dial, attempt 1');
res = await call(`/interviews/${interviewId}/worker/claim`, { method: 'POST', worker: true });
assert(res.status === 409, 'a second claim is refused — never dialed twice');
assert(!(await isDue(interviewId)), 'no longer listed as due while dialing');
const { interviews: dialing } = await req('/interviews/worker/phone-interviews/dialing', { worker: true });
assert(dialing.some((i) => i.id === interviewId), 'listed as currently dialing (agent fallback lookup)');
let status = await req(`/interviews/${interviewId}/worker/call-status`, { method: 'POST', worker: true, body: { status: 'NO_ANSWER', reason: 'twilio:no-answer' } });
assert(status.callStatus === 'PENDING' && new Date(status.nextCallAt) > new Date(), 'no answer -> retry scheduled a few minutes later');
assert(!(await isDue(interviewId)), 'retry is not due yet');

console.log('\n== Company "Call now" makes it due immediately ==');
const callNow = await req(`/interviews/${interviewId}/call-now`, { method: 'POST', token: companyToken });
assert(callNow.callStatus === 'PENDING', 'call-now accepted');
assert(await isDue(interviewId), 'due immediately after call-now');

console.log('\n== Candidate picks up: agent starts the interview ==');
await req(`/interviews/${interviewId}/worker/claim`, { method: 'POST', worker: true });
await req(`/interviews/${interviewId}/worker/call-status`, { method: 'POST', worker: true, body: { status: 'DIALING', twilioCallSid: 'CA_test_1' } });
res = await call(`/interviews/${interviewId}/call-now`, { method: 'POST', token: companyToken });
assert(res.status === 409, 'call-now is refused while the candidate is already being called');
const started = await req(`/interviews/${interviewId}/worker/start`, { method: 'POST', worker: true, body: { roomName: 'call-test' } });
assert(started.state.status === 'IN_PROGRESS' && started.state.callStatus === 'IN_CALL', 'interview IN_PROGRESS, call IN_CALL');
assert(started.state.question.type === 'INTRODUCTION' && started.state.resumed === false, 'first question is the introduction');
assert(started.state.answerTimeSeconds === 30 && started.state.mode === 'PHONE', 'agent receives the answer timer + mode');
console.log('  Q (INTRODUCTION):', started.state.question.text);

const answer = (q) =>
  `Simulated phone answer to "${q.text}". I have built production React apps with hooks, integrated REST APIs, and led code reviews.`;

let current = started.state.question;
let result = await req(`/interviews/${interviewId}/worker/answer`, {
  method: 'POST',
  worker: true,
  body: { questionId: current.id, transcript: answer(current), durationSeconds: 20, timedOut: false },
});
current = result.question;

console.log('\n== Line drops mid-interview -> redial resumes (never restarts) ==');
status = await req(`/interviews/${interviewId}/worker/call-status`, { method: 'POST', worker: true, body: { status: 'DROPPED', reason: 'caller hung up' } });
assert(status.callStatus === 'PENDING' && status.status === 'IN_PROGRESS', 'dropped -> redial scheduled, interview still IN_PROGRESS');
await req(`/interviews/${interviewId}/call-now`, { method: 'POST', token: companyToken });
await req(`/interviews/${interviewId}/worker/claim`, { method: 'POST', worker: true });
const resumed = await req(`/interviews/${interviewId}/worker/start`, { method: 'POST', worker: true, body: { roomName: 'call-test-2' } });
assert(resumed.state.resumed === true && resumed.state.question.id === current.id, 'redial resumes at the same unanswered question');

console.log('\n== Rest of the interview over the phone ==');
let turns = 0;
while (turns++ < 20) {
  result = await req(`/interviews/${interviewId}/worker/answer`, {
    method: 'POST',
    worker: true,
    body: { questionId: current.id, transcript: answer(current), durationSeconds: 25, timedOut: false },
  });
  if (result.done) break;
  current = result.question;
}
assert(result.done, `interview finished (${turns} more answers)`);
status = await req(`/interviews/${interviewId}/worker/call-status`, { method: 'POST', worker: true, body: { status: 'COMPLETED' } });
assert(status.callStatus === 'COMPLETED', 'call marked COMPLETED');

console.log('\n== Same report as an online interview ==');
const { interview: detail } = await req(`/interviews/${interviewId}`, { token: companyToken });
assert(detail.status === 'COMPLETED' && detail.mode === 'PHONE', 'company sees a COMPLETED telephonic interview');
assert(detail.report?.status === 'COMPLETED', 'final AI report generated, status: ' + detail.report?.status);
assert(typeof detail.report.overallScore === 'number', `overall score: ${detail.report.overallScore}%`);
console.log('  technical:', detail.report.technicalScore, ' communication:', detail.report.communicationScore);
assert((detail.report.questionAnalysis?.length || 0) > 0, 'question-by-question analysis present');
// Informational: with a small question budget, follow-ups can legitimately
// take the resume-question slot (same engine rule as online interviews).
console.log('  stages asked:', [...new Set(detail.questions.map((q) => q.stage))].join(' -> '));
const eventTypes = new Set(detail.events.map((e) => e.type));
for (const type of ['CALL_DIALING', 'CALL_NO_ANSWER', 'CALL_ANSWERED', 'CALL_DROPPED', 'CALL_ENDED', 'INTERVIEW_STARTED', 'INTERVIEW_ENDED']) {
  assert(eventTypes.has(type), `event logged: ${type}`);
}
const { application: finalApp } = await req(`/applications/mine/${main.application.id}`, { token: main.token });
assert(finalApp.status === 'INTERVIEW_COMPLETED', 'application moved to INTERVIEW_COMPLETED');

console.log('\n== Never answered: retries run out -> cancelled, candidate can rebook ==');
const ghost = await newShortlistedCandidate('ghost', job.id, companyToken);
const { interview: ghostBooked } = await req(`/scheduling/applications/${ghost.application.id}/book`, {
  method: 'POST',
  token: ghost.token,
  body: { slotId: phoneSlots[1].id, phoneNumber: '+919812345678' },
});
for (let attempt = 1; attempt <= 3; attempt++) {
  await req(`/interviews/${ghostBooked.id}/worker/claim`, { method: 'POST', worker: true });
  status = await req(`/interviews/${ghostBooked.id}/worker/call-status`, { method: 'POST', worker: true, body: { status: 'NO_ANSWER' } });
}
assert(status.callStatus === 'NO_ANSWER' && status.status === 'CANCELLED', 'after 3 unanswered attempts: NO_ANSWER + interview CANCELLED');
const { application: ghostApp } = await req(`/applications/mine/${ghost.application.id}`, { token: ghost.token });
assert(ghostApp.status === 'SHORTLISTED', 'candidate is back to SHORTLISTED and can book again');
const { slots: ghostSlots } = await req(`/scheduling/applications/${ghost.application.id}/slots`, { token: ghost.token });
assert(ghostSlots.find((s) => s.id === phoneSlots[1].id).status === 'AVAILABLE', 'the slot (not yet over) is AVAILABLE again');

console.log('\n== Online interviews unchanged ==');
const web = await newShortlistedCandidate('web', job.id, companyToken);
const { interview: webBooked } = await req(`/scheduling/applications/${web.application.id}/book`, {
  method: 'POST',
  token: web.token,
  body: { slotId: onlineSlots[0].id },
});
assert(webBooked.mode === 'ONLINE' && webBooked.callStatus === null, 'ONLINE booking needs no phone and has no call status');
const webStart = await req(`/interviews/${webBooked.id}/start`, { method: 'POST', token: web.token });
assert(typeof webStart.token === 'string' && webStart.question.type === 'INTRODUCTION', 'browser join still works for ONLINE');
assert(!(await isDue(webBooked.id)), 'ONLINE interviews are never dialed');
res = await call(`/interviews/${webBooked.id}/call-now`, { method: 'POST', token: companyToken });
assert(res.status === 400, 'call-now is rejected for an ONLINE interview');

console.log('\n== Worker endpoints require the secret ==');
const noSecret = await fetch(`${BASE}/interviews/worker/phone-interviews/due`);
assert(noSecret.status === 401, 'due list without the worker secret -> 401');

console.log('\nALL TELEPHONIC INTERVIEW TESTS PASSED ✔');
