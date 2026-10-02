// Build plan P7 acceptance test (docs/implementation-plan.html "Done when"):
//   - with a threshold set, a finished interview gives a final score and QUALIFIED / NOT_QUALIFIED
//   - submitting emails the HR person, stores a snapshot, candidate shows SUBMITTED_TO_CLIENT
//   - jobs without a threshold behave as today
// Plus: candidates never see the new statuses or the final score, the HR
// link marks the submission viewed and serves the CV, duplicates are
// refused, re-screening never overwrites a submitted candidate, auto-submit,
// SUBMIT_CANDIDATES permission.
//   node scripts/test-p7-final-score-submission.mjs
import 'dotenv/config';
import { buildDocx, reactResumeLines, DOCX_MIME } from './lib/testDocx.mjs';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ts = Date.now();
const PASSWORD = 'password123';
let passed = 0;

async function call(path, { method = 'GET', body, token, form, raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  if (raw) return res;
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

// Candidate applies → screening → shortlist → slot → interview → end.
async function interviewedCandidate(owner, jobId, label) {
  const email = `p7-${label}-${ts}@test.com`;
  const cand = await req('/auth/register/candidate', { method: 'POST', body: { email, password: PASSWORD, fullName: `P7 ${label}` } });
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines(`P7 ${label}`, email, '+919812300007'))], { type: DOCX_MIME }), 'cv.docx');
  const { resume } = await req('/resumes', { method: 'POST', token: cand.token, form });
  const { application } = await req('/applications', { method: 'POST', token: cand.token, body: { jobId, resumeId: resume.id } });
  await req(`/screening/job/${jobId}/run`, { method: 'POST', token: owner.token });
  await req(`/applications/job/${jobId}/bulk-status`, { method: 'PATCH', token: owner.token, body: { applicationIds: [application.id], status: 'SHORTLISTED' } });
  const start = new Date(Date.now() - 5 * 60 * 1000);
  const { slots } = await req(`/scheduling/jobs/${jobId}/slots/generate`, {
    method: 'POST',
    token: owner.token,
    body: { rangeStart: start.toISOString(), rangeEnd: new Date(start.getTime() + 15 * 60 * 1000).toISOString(), durationMinutes: 15 },
  });
  const { interview } = await req(`/scheduling/applications/${application.id}/book`, { method: 'POST', token: cand.token, body: { slotId: slots[0].id } });
  const started = await req(`/interviews/${interview.id}/start`, { method: 'POST', token: cand.token });
  const text = 'I have three years of React experience: hooks, Redux, REST API integration, and performance tuning in production.';
  await req(`/interviews/${interview.id}/answer`, { method: 'POST', token: cand.token, body: { questionId: started.question.id, transcript: text, rawTranscript: text } });
  await req(`/interviews/${interview.id}/end`, { method: 'POST', token: cand.token });
  return { cand, application, interviewId: interview.id };
}

async function main() {
  step('1. Agency, client → IT → HR, and a job with a final threshold');
  const owner = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p7-owner-${ts}@test.com`, password: PASSWORD, companyName: `P7 Agency ${ts}` },
  });
  let { client } = await req('/clients', { method: 'POST', token: owner.token, body: { name: `P7 Client ${ts}` } });
  ({ client } = await req(`/clients/${client.id}/departments`, { method: 'POST', token: owner.token, body: { name: 'IT' } }));
  const dept = client.departments[0];
  ({ client } = await req(`/clients/departments/${dept.id}/hiring-persons`, {
    method: 'POST',
    token: owner.token,
    body: { fullName: 'Hema HR', email: `p7-hr-${ts}@test.com`, designation: 'IT Hiring Manager' },
  }));
  // const hr = client.departments[0].hiringPersons[0];
  const hr = client.hiringPersons[0]; // Company HR belong to the company (department = label)
  const jobBody = {
    description: 'Build React front-ends with JavaScript, HTML and CSS against REST APIs.',
    requiredSkills: ['React', 'JavaScript'],
    status: 'OPEN',
    clientCompanyId: client.id,
    departmentId: dept.id,
    hiringPersonId: hr.id,
  };
  const { job } = await req('/jobs', { method: 'POST', token: owner.token, body: { ...jobBody, title: `P7 Threshold Job ${ts}`, finalThreshold: 1, cvWeight: 0.3, interviewWeight: 0.7 } });
  assert(job.finalThreshold === 1 && job.cvWeight === 0.3 && job.interviewWeight === 0.7 && job.autoSubmitToClient === false, 'job saved with threshold and weights');

  step('2. Finished interview → final score → QUALIFIED');
  const a = await interviewedCandidate(owner, job.id, 'alice');
  const { application: aApp } = await req(`/applications/job/${job.id}/candidates/${a.application.candidateId}`, { token: owner.token });
  assert(typeof aApp.finalScore === 'number', `final score recorded (${aApp.finalScore})`);
  assert(aApp.status === 'QUALIFIED', `threshold 1 → QUALIFIED (${aApp.status})`);
  const cv = aApp.screeningResult?.overallScore;
  const { interview: aInt } = await req(`/interviews/${a.interviewId}`, { token: owner.token });
  const expected = Math.round(((cv * 0.3 + aInt.report.overallScore * 0.7) / 1) * 10) / 10;
  assert(Math.abs(aApp.finalScore - expected) < 0.11, `final = CV ${cv} × 0.3 + interview ${aInt.report.overallScore} × 0.7 = ${expected}`);

  step('3. Candidate never sees the new status or the final score');
  const { application: mine } = await req(`/applications/mine/${a.application.id}`, { token: a.cand.token });
  assert(mine.status === 'INTERVIEW_COMPLETED' && !('finalScore' in mine), 'candidate sees INTERVIEW_COMPLETED, no final score');

  step('4. Submit to the job\'s HR person');
  const overview = await req(`/submissions/applications/${a.application.id}`, { token: owner.token });
  assert(overview.canSubmit && overview.defaultHiringPersonId === hr.id, 'overview offers the job\'s HR person by default');
  assert(overview.preview.candidate.fullName === 'P7 alice' && overview.preview.interview?.overallScore != null && overview.preview.cvMatch, 'preview package has contact, CV match and interview');
  const sent = await req('/submissions', { method: 'POST', token: owner.token, body: { applicationId: a.application.id, note: 'Strong React profile.' } });
  assert(sent.submission.recipientEmail === `p7-hr-${ts}@test.com` && sent.link.includes('/submission/'), 'submitted to the HR person with a secure link');
  const { application: aAfter } = await req(`/applications/job/${job.id}/candidates/${a.application.candidateId}`, { token: owner.token });
  assert(aAfter.status === 'SUBMITTED_TO_CLIENT', 'application is SUBMITTED_TO_CLIENT');
  const dup = await call('/submissions', { method: 'POST', token: owner.token, body: { applicationId: a.application.id } });
  assert(dup.status === 409 && dup.json?.error === 'ALREADY_SUBMITTED', 'sending twice to the same HR → 409');
  const manual = await req('/submissions', {
    method: 'POST',
    token: owner.token,
    body: { applicationId: a.application.id, recipientEmail: `p7-other-hr-${ts}@test.com`, recipientName: 'Other HR' },
  });
  assert(manual.submission.recipientName === 'Other HR', 'can also send to a hand-typed HR email');

  step('5. HR opens the read-only link');
  const token = sent.link.split('/submission/')[1];
  const view = await req(`/public/submissions/${token}`);
  assert(view.snapshot.candidate.email === `p7-alice-${ts}@test.com` && view.snapshot.note === 'Strong React profile.', 'HR sees the frozen package');
  assert(view.snapshot.finalScore === aApp.finalScore, 'package includes the final score');
  const cvRes = await call(`/public/submissions/${token}/cv`, { raw: true });
  assert(cvRes.status === 200 && (cvRes.headers.get('content-type') || '').includes('wordprocessingml'), 'CV downloads from the link');
  const { history } = await req(`/submissions/applications/${a.application.id}`, { token: owner.token });
  assert(history.find((h) => h.recipientEmail === `p7-hr-${ts}@test.com`)?.status === 'VIEWED', 'history shows the submission as VIEWED');
  assert((await call('/public/submissions/deadbeef')).status === 404, 'bad link → 404');

  step('6. Re-screening never overwrites a submitted candidate');
  await req(`/screening/job/${job.id}/run?force=true`, { method: 'POST', token: owner.token, body: { force: true } });
  const { application: stillSub } = await req(`/applications/job/${job.id}/candidates/${a.application.candidateId}`, { token: owner.token });
  assert(stillSub.status === 'SUBMITTED_TO_CLIENT', 'still SUBMITTED_TO_CLIENT after a forced re-screen');

  step('7. Job without a threshold behaves as today; then auto-submit on');
  const { job: job2 } = await req('/jobs', { method: 'POST', token: owner.token, body: { ...jobBody, title: `P7 No Threshold ${ts}` } });
  assert(job2.finalThreshold === null, 'second job has no threshold');
  const b = await interviewedCandidate(owner, job2.id, 'bob');
  const { application: bApp } = await req(`/applications/job/${job2.id}/candidates/${b.application.candidateId}`, { token: owner.token });
  assert(bApp.status === 'INTERVIEW_COMPLETED' && typeof bApp.finalScore === 'number', `no threshold → stays INTERVIEW_COMPLETED (score ${bApp.finalScore} recorded)`);
  await req(`/jobs/${job2.id}`, { method: 'PATCH', token: owner.token, body: { finalThreshold: 0, autoSubmitToClient: true } });
  const rescored = await req(`/submissions/jobs/${job2.id}/final-scores`, { method: 'POST', token: owner.token });
  assert(rescored.rescored === 1, 'recalculate re-scores the job\'s interviewed candidates');
  const { application: bAuto } = await req(`/applications/job/${job2.id}/candidates/${b.application.candidateId}`, { token: owner.token });
  assert(bAuto.status === 'SUBMITTED_TO_CLIENT', `auto-submit sent the qualified candidate (${bAuto.status})`);
  const { history: bHist } = await req(`/submissions/applications/${b.application.id}`, { token: owner.token });
  assert(bHist[0]?.submittedBy === 'Automatic' && bHist[0].recipientEmail === `p7-hr-${ts}@test.com`, 'history shows an automatic submission to the job\'s HR');

  step('8. SUBMIT_CANDIDATES permission');
  const inv = await req('/recruiters', {
    method: 'POST',
    token: owner.token,
    body: { email: `p7-rec-${ts}@test.com`, fullName: 'P7 Recruiter', permissions: ['REVIEW_CANDIDATES'], jobIds: [job.id] },
  });
  const tR = (await req('/auth/set-password', { method: 'POST', body: { token: new URL(inv.setupLink).searchParams.get('token'), password: PASSWORD } })).token;
  const rView = await call(`/submissions/applications/${a.application.id}`, { token: tR });
  assert(rView.status === 200, 'recruiter with Review candidates can see the submission overview');
  const rSend = await call('/submissions', { method: 'POST', token: tR, body: { applicationId: a.application.id, recipientEmail: `p7-x-${ts}@test.com` } });
  assert(rSend.status === 403 && rSend.json?.error === 'PERMISSION_DENIED', 'without Submit candidates → 403');

  console.log(`\nPHASE 7 TESTS PASSED ✔  (${passed} checks)`);
}

main().catch((err) => {
  console.error(`\nPHASE 7 TEST FAILED after ${passed} passing checks:`, err.message);
  process.exitCode = 1;
});
