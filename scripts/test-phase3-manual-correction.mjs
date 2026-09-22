// Focused Phase 3 test for the manual "Correct transcription" flow
// (Section 2): submits an answer with manuallyCorrected + a
// correctedTranscript that differs from the raw transcript, then reads it
// back via the company's interview-detail endpoint and asserts rawTranscript
// is preserved unmodified while correctedTranscript/manuallyCorrected
// reflect the edit.
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
  body: { email: `p3-correct-company-${ts}@test.com`, password: 'password123', companyName: 'Phase3 Correction Test Co' },
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
  body: { aiName: 'Priya', aiTitle: 'Virtual HR', questionCount: 4, answerTimeSeconds: 20, customQuestions: [] },
});

console.log('\n== Candidate applies, gets shortlisted, books an AI interview slot ==');
const { token: candidateToken } = await req('/auth/register/candidate', {
  method: 'POST',
  body: { email: `p3-correct-candidate-${ts}@test.com`, password: 'password123', fullName: 'Casey Correction' },
});
const docxPath = process.argv[2];
if (!docxPath) throw new Error('Usage: node test-phase3-manual-correction.mjs <path-to-resume.docx>');
const { readFileSync } = await import('fs');
const docxBuffer = readFileSync(docxPath);
const form = new FormData();
form.append('resume', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'resume.docx');
const uploadRes = await fetch(`${BASE}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${candidateToken}` }, body: form });
const { resume } = (await uploadRes.json()).data;
const { application } = await req('/applications', { method: 'POST', token: candidateToken, body: { jobId: job.id, resumeId: resume.id } });
await req(`/applications/job/${job.id}/bulk-status`, { method: 'PATCH', token: companyToken, body: { applicationIds: [application.id], status: 'SHORTLISTED' } });

const rangeStart = new Date(Date.now() - 5 * 60 * 1000);
const rangeEnd = new Date(rangeStart.getTime() + 60 * 60 * 1000);
const { slots } = await req(`/scheduling/jobs/${job.id}/slots/generate`, {
  method: 'POST',
  token: companyToken,
  body: { rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString(), durationMinutes: 15, bufferMinutes: 0 },
});
const { interview: booked } = await req(`/scheduling/applications/${application.id}/book`, { method: 'POST', token: candidateToken, body: { slotId: slots[0].id } });
const interviewId = booked.id;

console.log('\n== Candidate joins and submits a manually-corrected answer to the introduction question ==');
const startResult = await req(`/interviews/${interviewId}/start`, { method: 'POST', token: candidateToken });
const introQuestion = startResult.question;
assert(introQuestion.type === 'INTRODUCTION', 'first question is the introduction');

const rawText = 'I use user state to manage data in react and I have worked with rest full AP Is before.';
const correctedText = 'I use useState to manage data in React and I have worked with RESTful APIs before.';

// This goes through the CANDIDATE-JWT route (the browser's push-to-talk
// path), not the worker-secret route, since manual correction is a
// browser-side affordance.
const afterCorrection = await req(`/interviews/${interviewId}/answer`, {
  method: 'POST',
  token: candidateToken,
  body: {
    questionId: introQuestion.id,
    transcript: correctedText, // effective value the browser would send: corrected ?? raw
    rawTranscript: rawText,
    correctedTranscript: correctedText,
    manuallyCorrected: true,
    durationSeconds: 8,
    timedOut: false,
  },
});
assert(afterCorrection.done === false, 'interview advances past the introduction');

console.log('\n== Reading back via the company detail endpoint ==');
const companyView = await req(`/interviews/${interviewId}`, { token: companyToken });
const answeredIntro = companyView.interview.questions.find((q) => q.id === introQuestion.id);
assert(answeredIntro?.answer != null, 'the introduction question has a stored answer');
assert(answeredIntro.answer.rawTranscript === rawText, 'rawTranscript preserved exactly as the (uncorrected) STT output');
assert(answeredIntro.answer.manuallyCorrected === true, 'manuallyCorrected flag is true');
assert(answeredIntro.answer.correctedTranscript === correctedText, 'correctedTranscript stores the candidate\'s edited text');
assert(answeredIntro.answer.transcript === rawText, 'the legacy transcript column stays in sync with rawTranscript, not the correction');

console.log('\n== A normal (uncorrected) answer on the next question does not set manuallyCorrected ==');
const nextQuestion = afterCorrection.question;
const normalAnswer = await req(`/interviews/${interviewId}/answer`, {
  method: 'POST',
  token: candidateToken,
  body: { questionId: nextQuestion.id, transcript: 'A perfectly normal spoken answer with no correction needed.', rawTranscript: 'A perfectly normal spoken answer with no correction needed.', durationSeconds: 6, timedOut: false },
});
assert(typeof normalAnswer.done === 'boolean', 'second answer submitted successfully');
const companyViewAfterSecond = await req(`/interviews/${interviewId}`, { token: companyToken });
const answeredSecond = companyViewAfterSecond.interview.questions.find((q) => q.id === nextQuestion.id);
assert(answeredSecond.answer.manuallyCorrected === false, 'an uncorrected answer has manuallyCorrected = false');
assert(answeredSecond.answer.correctedTranscript == null, 'an uncorrected answer has no correctedTranscript');

console.log('\nALL PHASE 3 MANUAL-CORRECTION TESTS PASSED ✔');
