// Focused Phase 3 test for adaptive difficulty (Section 5): drives an
// interview with deliberately alternating weak/strong scripted answers and
// asserts that each newly-created planned (non-custom, non-candidate-
// question) question's difficulty matches interviewDifficulty.util.js's
// nextDifficulty() rule table exactly, given the base difficulty of
// whichever question was most recently answered (planned or follow-up —
// a follow-up always inherits its parent's difficulty unchanged, so the
// "base" for the next transition is simply the last-answered question's
// difficulty, falling back to MEDIUM when null).
//
// Like the main Phase 3 script, this drives the state machine via the
// worker-secret routes (simulating the livekit-worker), not real audio.
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

const DIFFICULTY_ORDER = ['EASY', 'MEDIUM', 'HARD'];
function nextDifficulty(current, strength) {
  const idx = DIFFICULTY_ORDER.indexOf(current || 'MEDIUM');
  if (strength === 'STRONG') return DIFFICULTY_ORDER[Math.min(idx + 1, 2)];
  if (strength === 'WEAK') return DIFFICULTY_ORDER[Math.max(idx - 1, 0)];
  return DIFFICULTY_ORDER[idx];
}
// Mirrors interviewEngine.service.js exactly: the transition FROM the
// introduction always resolves to MEDIUM regardless of answer strength,
// since the introduction isn't a technical signal.
function predictNextDifficulty(baseDifficulty, strength, lastAnsweredStage) {
  if (lastAnsweredStage === 'INTRODUCTION') return 'MEDIUM';
  return nextDifficulty(baseDifficulty, strength);
}

const WEAK_ANSWER = "I don't know. I've never worked with anything like that and have no idea how to approach it.";
const STRONG_ANSWER =
  'Absolutely. I would use React hooks like useState and useMemo to manage and memoize derived state, structure the ' +
  'REST API calls through a dedicated service layer with proper error handling and retries, and profile re-renders ' +
  'with the React DevTools profiler to catch unnecessary updates before they become a performance problem in production.';

console.log('== Setup: company + job + AI interviewer config (adaptive) ==');
const { token: companyToken } = await req('/auth/register/company', {
  method: 'POST',
  body: { email: `p3-diff-company-${ts}@test.com`, password: 'password123', companyName: 'Phase3 Difficulty Test Co' },
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
  body: { aiName: 'Priya', aiTitle: 'Virtual HR', questionCount: 8, answerTimeSeconds: 20, customQuestions: [], difficultyStrategy: 'ADAPTIVE' },
});

console.log('\n== Candidate applies, gets shortlisted, books an AI interview slot ==');
const { token: candidateToken } = await req('/auth/register/candidate', {
  method: 'POST',
  body: { email: `p3-diff-candidate-${ts}@test.com`, password: 'password123', fullName: 'Sam Difficulty' },
});
const docxPath = process.argv[2];
if (!docxPath) throw new Error('Usage: node test-phase3-difficulty-adaptation.mjs <path-to-resume.docx>');
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

console.log('\n== Driving the interview with alternating weak/strong scripted answers ==');
const startResult = await req(`/interviews/${interviewId}/start`, { method: 'POST', token: candidateToken });
let current = startResult.question; // the question we're about to answer
let turnIndex = 0;
let checkedAtLeastOneTransition = false;
let turns = 0;

while (turns < 30) {
  turns++;
  const strength = turnIndex % 2 === 0 ? 'WEAK' : 'STRONG';
  turnIndex++;
  const answer = strength === 'WEAK' ? WEAK_ANSWER : STRONG_ANSWER;

  // Capture the question we're about to answer BEFORE submitting — this is
  // the "base" the engine transitions from, exactly mirroring
  // advanceInterviewCore's `question.difficulty || 'MEDIUM'` and
  // `question.stage === 'INTRODUCTION'` check.
  const answeredDifficulty = current.difficulty || 'MEDIUM';
  const answeredStage = current.stage;

  const result = await req(`/interviews/${interviewId}/worker/answer`, {
    method: 'POST',
    worker: true,
    body: { questionId: current.id, transcript: answer, durationSeconds: 10, timedOut: false },
  });

  if (result.done) {
    console.log(`  Interview finished after ${turns} answered question(s).`);
    break;
  }

  if (!result.isFollowUp && result.stage !== 'CANDIDATE_QUESTIONS' && result.question.type !== 'CUSTOM') {
    const expected = predictNextDifficulty(answeredDifficulty, strength, answeredStage);
    assert(
      result.question.difficulty === expected,
      `after a ${strength} answer to a ${answeredStage} question (base ${answeredDifficulty}), next planned question is ${expected} (got ${result.question.difficulty})`
    );
    checkedAtLeastOneTransition = true;
  }

  current = result.question;
}

assert(checkedAtLeastOneTransition, 'at least one difficulty transition was actually verified during the run');

console.log('\nALL PHASE 3 DIFFICULTY-ADAPTATION TESTS PASSED ✔');
