// Build plan P6 acceptance test (docs/implementation-plan.html "Done when"):
//   - with instructions set, the report lists the recruiter criteria
//   - with them empty, prompts are unchanged (tests/unit/recruiterGuidancePrompts.test.mjs)
// Plus: config round-trip, omitting the fields keeps them, candidates don't
// see the criteria verdicts, length limits.
//   node scripts/test-p6-recruiter-instructions.mjs
import 'dotenv/config';
import { buildDocx, reactResumeLines, DOCX_MIME } from './lib/testDocx.mjs';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ts = Date.now();
const PASSWORD = 'password123';
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

async function main() {
  step('1. Company, job and AI interviewer guidance');
  const owner = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p6-owner-${ts}@test.com`, password: PASSWORD, companyName: `P6 Co ${ts}` },
  });
  const { job } = await req('/jobs', {
    method: 'POST',
    token: owner.token,
    body: {
      title: `P6 React Dev ${ts}`,
      description: 'Build React front-ends with JavaScript against REST APIs.',
      requiredSkills: ['React', 'JavaScript'],
      status: 'OPEN',
    },
  });
  const { config: defaults } = await req(`/interviews/config/${job.id}`, { token: owner.token });
  assert(defaults.interviewInstructions === null && defaults.evaluationInstructions === null && defaults.focusSkills.length === 0, 'no guidance by default');

  const guidance = {
    aiName: 'Priya',
    aiTitle: 'Virtual HR',
    questionCount: 4,
    answerTimeSeconds: 30,
    customQuestions: [],
    voiceGender: 'FEMALE',
    interviewInstructions: 'Check hands-on React hooks experience. Ask about a production bug they fixed.',
    evaluationInstructions: 'React knowledge counts double. Communication must be clear and structured.',
    focusSkills: ['React hooks', 'REST APIs'],
  };
  const { config } = await req(`/interviews/config/${job.id}`, { method: 'PATCH', token: owner.token, body: guidance });
  assert(config.interviewInstructions === guidance.interviewInstructions && config.focusSkills.length === 2, 'guidance saved');
  const { config: kept } = await req(`/interviews/config/${job.id}`, {
    method: 'PATCH',
    token: owner.token,
    body: { aiName: 'Priya', questionCount: 4 },
  });
  assert(kept.evaluationInstructions === guidance.evaluationInstructions, 'saving without the new fields keeps them');
  const tooLong = await call(`/interviews/config/${job.id}`, { method: 'PATCH', token: owner.token, body: { ...guidance, interviewInstructions: 'x'.repeat(2001) } });
  assert(tooLong.status === 400, 'instructions over 2000 characters → 400');

  step('2. Candidate interview (slot flow)');
  const email = `p6-cand-${ts}@test.com`;
  const cand = await req('/auth/register/candidate', { method: 'POST', body: { email, password: PASSWORD, fullName: 'P6 Candidate' } });
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines('P6 Candidate', email, '+919812300006'))], { type: DOCX_MIME }), 'cv.docx');
  const { resume } = await req('/resumes', { method: 'POST', token: cand.token, form });
  const { application } = await req('/applications', { method: 'POST', token: cand.token, body: { jobId: job.id, resumeId: resume.id } });
  await req(`/applications/job/${job.id}/bulk-status`, { method: 'PATCH', token: owner.token, body: { applicationIds: [application.id], status: 'SHORTLISTED' } });
  const start = new Date(Date.now() - 5 * 60 * 1000);
  const { slots } = await req(`/scheduling/jobs/${job.id}/slots/generate`, {
    method: 'POST',
    token: owner.token,
    body: { rangeStart: start.toISOString(), rangeEnd: new Date(start.getTime() + 30 * 60 * 1000).toISOString(), durationMinutes: 15 },
  });
  const { interview } = await req(`/scheduling/applications/${application.id}/book`, { method: 'POST', token: cand.token, body: { slotId: slots[0].id } });
  const started = await req(`/interviews/${interview.id}/start`, { method: 'POST', token: cand.token });
  let current = started.question;
  const answer =
    'I use React hooks daily — useEffect for data fetching, useMemo for expensive lists and custom hooks for forms. ' +
    'Recently I fixed a production bug where a stale closure in useEffect showed old prices; I added the missing dependency and a test.';
  for (let i = 0; i < 2 && current; i++) {
    const r = await req(`/interviews/${interview.id}/answer`, { method: 'POST', token: cand.token, body: { questionId: current.id, transcript: answer, rawTranscript: answer } });
    current = r.done ? null : r.question;
  }
  await req(`/interviews/${interview.id}/end`, { method: 'POST', token: cand.token });

  step('3. Report lists the recruiter criteria (company only)');
  const { interview: detail } = await req(`/interviews/${interview.id}`, { token: owner.token });
  assert(detail.report?.status === 'COMPLETED', `report COMPLETED (score ${detail.report?.overallScore})`);
  const crit = detail.report.criteriaAssessment;
  assert(Array.isArray(crit) && crit.length > 0, `report has ${crit?.length} criteria verdicts`);
  assert(crit.every((c) => ['MET', 'PARTLY', 'NOT_MET'].includes(c.verdict) && c.criterion), 'each verdict is MET / PARTLY / NOT_MET with a criterion');
  console.log('   ', crit.map((c) => `${c.verdict}: ${c.criterion}`).join(' | '));
  const { interview: candView } = await req(`/interviews/${interview.id}`, { token: cand.token });
  assert(candView.report && !('criteriaAssessment' in candView.report), "the candidate's view doesn't include the criteria verdicts");

  step('4. Clearing the guidance');
  const { config: cleared } = await req(`/interviews/config/${job.id}`, {
    method: 'PATCH',
    token: owner.token,
    body: { ...guidance, interviewInstructions: '', evaluationInstructions: null, focusSkills: [] },
  });
  assert(!cleared.interviewInstructions && !cleared.evaluationInstructions && cleared.focusSkills.length === 0, 'guidance can be cleared');

  console.log(`\nPHASE 6 TESTS PASSED ✔  (${passed} checks)`);
}

main().catch((err) => {
  console.error(`\nPHASE 6 TEST FAILED after ${passed} passing checks:`, err.message);
  process.exitCode = 1;
});
