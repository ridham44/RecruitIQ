// Full Phase 3 engine test: company configures the AI interviewer, a
// candidate books an AI interview slot, the candidate "joins" (gets a real
// LiveKit token + room), and we drive the full question/answer/follow-up
// state machine by simulating the livekit-worker's role directly (posting
// transcripts to the worker-secret-gated endpoints) — this exercises
// everything except literal audio I/O, which needs a real browser/mic and
// can't run in this environment.
const BASE = 'http://localhost:3001/api/v1';
const WORKER_SECRET = process.env.INTERVIEW_WORKER_SECRET || 'dev-local-interview-worker-secret-change-me';
const ts = Date.now();

async function req(path, { method = 'GET', body, token, worker = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (worker) headers['x-worker-secret'] = WORKER_SECRET;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`FAIL ${method} ${path} ->`, res.status, json);
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return json.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ok:', msg);
}

console.log('== Setup: company + job + AI interviewer config ==');
const { token: companyToken } = await req('/auth/register/company', {
  method: 'POST',
  body: { email: `p3-company-${ts}@test.com`, password: 'password123', companyName: 'Phase3 Test Co' },
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

const { config } = await req(`/interviews/config/${job.id}`, {
  method: 'PATCH',
  token: companyToken,
  body: {
    aiName: 'Priya',
    aiTitle: 'Virtual HR',
    questionCount: 6,
    answerTimeSeconds: 20,
    customQuestions: ['Why do you want to work with our team specifically?'],
  },
});
assert(config.aiName === 'Priya' && config.questionCount === 6, 'AI interviewer config saved');

console.log('\n== Candidate applies, gets shortlisted, AI slot generated + booked ==');
const { token: candidateToken } = await req('/auth/register/candidate', {
  method: 'POST',
  body: { email: `p3-candidate-${ts}@test.com`, password: 'password123', fullName: 'Jordan Rivera' },
});

const docxPath = process.argv[2];
if (!docxPath) throw new Error('Usage: node test-phase3-interview.mjs <path-to-resume.docx>');
const { readFileSync } = await import('fs');
const docxBuffer = readFileSync(docxPath);
const form = new FormData();
form.append('resume', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'resume.docx');
const uploadRes = await fetch(`${BASE}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${candidateToken}` }, body: form });
const { resume } = (await uploadRes.json()).data;
const { application } = await req('/applications', { method: 'POST', token: candidateToken, body: { jobId: job.id, resumeId: resume.id } });
await req(`/applications/job/${job.id}/bulk-status`, { method: 'PATCH', token: companyToken, body: { applicationIds: [application.id], status: 'SHORTLISTED' } });

// Started 5 minutes in the past so the slot is already joinable by the time
// we book it below (slot generation itself has no past/future restriction —
// only start() enforces the join window, tested separately further down).
const rangeStart = new Date(Date.now() - 5 * 60 * 1000);
const rangeEnd = new Date(rangeStart.getTime() + 60 * 60 * 1000);
const { slots } = await req(`/scheduling/jobs/${job.id}/slots/generate`, {
  method: 'POST',
  token: companyToken,
  body: {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    durationMinutes: 15,
    bufferMinutes: 0,
  },
});
assert(slots.length === 4, `reused Phase 2.5 slot generation for the AI interview (${slots.length} slots)`);

const { interview: booked } = await req(`/scheduling/applications/${application.id}/book`, { method: 'POST', token: candidateToken, body: { slotId: slots[0].id } });
const interviewId = booked.id;
assert(booked.status === 'SCHEDULED', 'candidate booked an AI interview slot (same booking flow as Phase 2)');

console.log('\n== Early-join guard: cannot start before the slot\'s scheduled time ==');
const { token: earlyCandidateToken } = await req('/auth/register/candidate', {
  method: 'POST',
  body: { email: `p3-early-candidate-${ts}@test.com`, password: 'password123', fullName: 'Alex Early' },
});
const earlyForm = new FormData();
earlyForm.append('resume', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'resume.docx');
const earlyUploadRes = await fetch(`${BASE}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${earlyCandidateToken}` }, body: earlyForm });
const { resume: earlyResume } = (await earlyUploadRes.json()).data;
const { application: earlyApplication } = await req('/applications', { method: 'POST', token: earlyCandidateToken, body: { jobId: job.id, resumeId: earlyResume.id } });
await req(`/applications/job/${job.id}/bulk-status`, { method: 'PATCH', token: companyToken, body: { applicationIds: [earlyApplication.id], status: 'SHORTLISTED' } });
const futureDay = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
const { slots: futureSlots } = await req(`/scheduling/jobs/${job.id}/slots/generate`, {
  method: 'POST',
  token: companyToken,
  body: {
    rangeStart: new Date(`${futureDay}T10:00:00`).toISOString(),
    rangeEnd: new Date(`${futureDay}T10:15:00`).toISOString(),
    durationMinutes: 15,
    bufferMinutes: 0,
  },
});
const { interview: earlyBooked } = await req(`/scheduling/applications/${earlyApplication.id}/book`, { method: 'POST', token: earlyCandidateToken, body: { slotId: futureSlots[0].id } });
// NOTE: interviewEngine.service.js's slot-time-window check is currently
// commented out ("TEMP (testing)") so interviews can be joined at any time
// for manual testing — this was an explicit, separate request in this
// session, and is intentionally left untouched by the Phase 3 upgrade. This
// assertion reflects that actual current behavior rather than the
// originally-intended guard; flip it back once the guard is restored.
const earlyStart = await req(`/interviews/${earlyBooked.id}/start`, { method: 'POST', token: earlyCandidateToken });
assert(typeof earlyStart.token === 'string', 'joining before the scheduled slot time currently succeeds (join-window guard is disabled for testing)');

console.log('\n== Candidate joins: gets LiveKit token + first (introduction) question ==');
const startResult = await req(`/interviews/${interviewId}/start`, { method: 'POST', token: candidateToken });
assert(typeof startResult.token === 'string' && startResult.token.length > 20, 'received a real signed LiveKit token');
assert(startResult.roomName === `interview-${interviewId}`, 'room name derived from interview id');
assert(startResult.interview.stage === 'INTRODUCTION', 'stage is INTRODUCTION after start');
assert(startResult.question.type === 'INTRODUCTION', 'first question is the templated introduction');
assert(startResult.aiName === 'Priya' && startResult.aiTitle === 'Virtual HR', 'response includes the configured AI interviewer name/title for the room UI');
console.log('  Q0 (INTRODUCTION):', startResult.question.text);

console.log('\n== Re-joining is idempotent (reconnect case) ==');
const rejoin = await req(`/interviews/${interviewId}/start`, { method: 'POST', token: candidateToken });
assert(rejoin.question.id === startResult.question.id, 'rejoining returns the SAME current question, not a new one');

// Mirrors interviewEngine.service.js's buildStagePlan/maxFollowUpBudget
// exactly, so the loop-termination bound below is the real documented cap,
// not an arbitrary safety ceiling.
function computeStagePlanLength(cfg) {
  const coreStages = ['RESUME_QUESTIONS', 'BASIC_TECHNICAL', 'JOB_SPECIFIC', 'SCENARIO', 'BEHAVIORAL'];
  const budgetForCore = Math.max(coreStages.length, cfg.questionCount - 1);
  const perStage = Math.max(1, Math.round(budgetForCore / coreStages.length));
  let total = 0;
  for (const s of coreStages) total += s === 'JOB_SPECIFIC' ? perStage + cfg.customQuestions.length : perStage;
  return total + 1; // + CANDIDATE_QUESTIONS
}
function computeMaxFollowUpBudget(cfg) {
  return Math.max(2, Math.ceil(cfg.questionCount / 3));
}
const maxTurns = 1 + computeStagePlanLength(config) + computeMaxFollowUpBudget(config); // 1 for the introduction turn

console.log('\n== Driving the full interview via the worker endpoints ==');
let current = startResult.question;
let stage = startResult.interview.stage;
let turns = 0;
const seenStages = new Set();
const seenTypes = new Set();
const seenDifficulties = new Set();
let sawFollowUp = false;

while (turns < maxTurns + 5) {
  turns++;
  seenStages.add(stage);
  seenTypes.add(current.type);
  if (current.difficulty) seenDifficulties.add(current.difficulty);
  const answer = `This is a simulated detailed answer for question: "${current.text}". I have hands-on experience with React hooks, REST API integration, and have shipped production features using these technologies.`;

  const result = await req(`/interviews/${interviewId}/worker/answer`, {
    method: 'POST',
    worker: true,
    body: { questionId: current.id, transcript: answer, durationSeconds: 12, timedOut: false },
  });

  if (result.done) {
    console.log(`  Interview finished after ${turns} answered question(s).`);
    break;
  }
  if (result.isFollowUp) sawFollowUp = true;
  current = result.question;
  stage = result.stage;
}
assert(turns <= maxTurns, `interview terminated within the documented bound (${turns} <= ${maxTurns} = 1 intro + ${computeStagePlanLength(config)} planned + ${computeMaxFollowUpBudget(config)} follow-up budget)`);
assert(seenStages.has('INTRODUCTION'), 'passed through INTRODUCTION');
assert(seenStages.has('JOB_SPECIFIC'), 'passed through JOB_SPECIFIC');
assert(seenStages.has('CANDIDATE_QUESTIONS'), 'passed through CANDIDATE_QUESTIONS');
assert(seenTypes.has('CUSTOM'), 'the company custom question was asked verbatim');
assert(seenDifficulties.size > 0, `adaptive difficulty was applied to at least one question (saw: ${[...seenDifficulties].join(', ')})`);

console.log('\n== Interview + application status after completion ==');
const finalState = await req(`/interviews/${interviewId}`, { token: candidateToken });
assert(finalState.interview.status === 'COMPLETED', 'interview status is COMPLETED');
assert(finalState.interview.stage === 'END', 'stage is END');

const { application: finalApp } = await req(`/applications/mine/${application.id}`, { token: candidateToken });
assert(finalApp.status === 'INTERVIEW_COMPLETED', 'application status is INTERVIEW_COMPLETED');

console.log('\n== Transcript normalization pipeline (Section 2) ==');
const answeredQuestions = finalState.interview.questions.filter((q) => q.answer && q.answer.transcript?.trim());
assert(answeredQuestions.length > 0, 'at least one answered question to inspect');
for (const q of answeredQuestions) {
  assert(typeof q.answer.rawTranscript === 'string' && q.answer.rawTranscript.length > 0, `rawTranscript stored for question ${q.id}`);
  assert(typeof q.answer.normalizedTranscript === 'string', `normalizedTranscript stored for question ${q.id}`);
}
assert(answeredQuestions.every((q) => q.answer.manuallyCorrected === false), 'no answers were manually corrected in this run');

console.log('\n== Final AI report was generated (synchronously, before the response returned) ==');
assert(finalState.interview.report != null, 'report exists');
assert(finalState.interview.report.status === 'COMPLETED', 'report status is COMPLETED, got: ' + finalState.interview.report.status);
console.log('  overallScore:', finalState.interview.report.overallScore);
console.log('  technicalScore:', finalState.interview.report.technicalScore);
console.log('  communicationScore:', finalState.interview.report.communicationScore);
console.log('  strengths:', finalState.interview.report.strengths);
console.log('  resumeAlignment:', JSON.stringify(finalState.interview.report.resumeAlignment));
console.log('  questionAnalysis count:', finalState.interview.report.questionAnalysis?.length);

const firstAnalysis = finalState.interview.report.questionAnalysis?.[0];
assert(firstAnalysis != null, 'questionAnalysis has at least one entry');
for (const dim of ['correctness', 'relevance', 'technicalDepth', 'communication', 'score']) {
  assert(typeof firstAnalysis[dim] === 'number', `questionAnalysis[0].${dim} is a number (structured scoring rubric present)`);
}

console.log('\n== Security/monitoring events ==');
await req(`/interviews/${interviewId}/events`, { method: 'POST', token: candidateToken, body: { type: 'TAB_SWITCH' } });
await req(`/interviews/${interviewId}/events`, { method: 'POST', token: candidateToken, body: { type: 'CAMERA_OFF' } });
const withEvents = await req(`/interviews/${interviewId}`, { token: candidateToken });
assert(withEvents.interview.events.some((e) => e.type === 'INTERVIEW_STARTED'), 'INTERVIEW_STARTED event logged automatically');
assert(withEvents.interview.events.some((e) => e.type === 'INTERVIEW_ENDED'), 'INTERVIEW_ENDED event logged automatically');
assert(withEvents.interview.events.some((e) => e.type === 'TAB_SWITCH'), 'candidate-logged TAB_SWITCH event recorded');
assert(withEvents.interview.events.some((e) => e.type === 'CAMERA_OFF'), 'candidate-logged CAMERA_OFF event recorded');

console.log('\n== Company can view the full interview detail (transcript, report, events) ==');
const companyView = await req(`/interviews/${interviewId}`, { token: companyToken });
assert(companyView.interview.questions.length === finalState.interview.questions.length, 'company sees the same full transcript');
assert(companyView.interview.report.status === 'COMPLETED', 'company sees the completed report');
assert(companyView.interview.voiceGender === 'FEMALE', 'interview detail includes the configured voiceGender (default FEMALE)');
assert(companyView.interview.questionCount === 6 && companyView.interview.answerTimeSeconds === 20, 'interview detail includes flattened interview-configuration fields');

console.log('\n== Voice config round-trip (Section 8) ==');
const { config: updatedConfig } = await req(`/interviews/config/${job.id}`, {
  method: 'PATCH',
  token: companyToken,
  body: { ...config, voiceGender: 'MALE' },
});
assert(updatedConfig.voiceGender === 'MALE', 'PATCH persists voiceGender = MALE');
const { config: reGetConfig } = await req(`/interviews/config/${job.id}`, { token: companyToken });
assert(reGetConfig.voiceGender === 'MALE', 'GET reflects the updated voiceGender');
const companyViewAfterVoiceChange = await req(`/interviews/${interviewId}`, { token: companyToken });
assert(
  companyViewAfterVoiceChange.interview.voiceGender === 'MALE',
  'interview detail reflects the job-level config change (config is per-job, not snapshotted per interview)'
);

console.log('\n== Company job-level interview list ==');
const { interviews: jobInterviews } = await req(`/interviews/job/${job.id}`, { token: companyToken });
assert(jobInterviews.some((i) => i.id === interviewId), 'interview shows up in the job-level list');

console.log('\n== Authorization: a different company cannot see this interview ==');
const { token: otherCompanyToken } = await req('/auth/register/company', {
  method: 'POST',
  body: { email: `p3-other-company-${ts}@test.com`, password: 'password123', companyName: 'Other Co' },
});
let forbidden = false;
try {
  await req(`/interviews/${interviewId}`, { token: otherCompanyToken });
} catch (err) {
  forbidden = true;
}
assert(forbidden, 'a different company gets rejected trying to view this interview');

console.log('\n== Authorization: worker routes reject a bad secret ==');
let workerAuthFailed = false;
try {
  await req(`/interviews/${interviewId}/worker/context`, { headers: { 'x-worker-secret': 'wrong-secret' } });
} catch {
  // req() with an explicit wrong header via fetch directly:
}
try {
  const res = await fetch(`${BASE}/interviews/${interviewId}/worker/context`, { headers: { 'x-worker-secret': 'wrong-secret' } });
  workerAuthFailed = res.status === 401;
} catch {
  workerAuthFailed = false;
}
assert(workerAuthFailed, 'wrong worker secret is rejected with 401');

console.log(`\nFollow-up question was generated at least once during the run: ${sawFollowUp}`);
console.log('\nALL PHASE 3 ENGINE TESTS PASSED ✔');
