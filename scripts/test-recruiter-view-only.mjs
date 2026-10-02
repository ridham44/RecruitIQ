// View-only agency recruiters (VIEW_CANDIDATES): see applicants on their
// assigned jobs, scores, CV (view + download) and interview results — and
// nothing else. Recruiters with REVIEW_CANDIDATES keep every action.
// Uses the running dev API (SMOKE_BASE_URL, default http://localhost:3001):
//   node scripts/test-recruiter-view-only.mjs
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
const tokenOf = (link) => new URL(link).searchParams.get('token');

async function invite(tOwner, label, permissions, jobIds) {
  const inv = await req('/recruiters', {
    method: 'POST',
    token: tOwner,
    body: { email: `vo-${label}-${ts}@test.com`, fullName: `VO ${label}`, permissions, jobIds },
  });
  const { token } = await req('/auth/set-password', { method: 'POST', body: { token: tokenOf(inv.setupLink), password: PASSWORD } });
  return token;
}

async function main() {
  step('0. Agency, 2 jobs, one applicant');
  const owner = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `vo-owner-${ts}@test.com`, password: PASSWORD, companyName: `VO Agency ${ts}` },
  });
  const tO = owner.token;
  const desc = 'Build React front-ends with JavaScript, HTML and CSS against REST APIs.';
  const { job } = await req('/jobs', { method: 'POST', token: tO, body: { title: `VO Job ${ts}`, description: desc, status: 'OPEN' } });
  const { job: other } = await req('/jobs', { method: 'POST', token: tO, body: { title: `VO Other ${ts}`, description: desc, status: 'OPEN' } });
  const cEmail = `vo-cand-${ts}@test.com`;
  const cand = await req('/auth/register/candidate', { method: 'POST', body: { email: cEmail, password: PASSWORD, fullName: 'VO Candidate' } });
  const form = new FormData();
  form.append('resume', new Blob([buildDocx(reactResumeLines('VO Candidate', cEmail, '+919811100001'))], { type: DOCX_MIME }), 'vo-cv.docx');
  const { resume } = await req('/resumes', { method: 'POST', token: cand.token, form });
  const { application } = await req('/applications', { method: 'POST', token: cand.token, body: { jobId: job.id, resumeId: resume.id } });
  const candidateId = (await req(`/applications/job/${job.id}`, { token: tO })).applications[0].candidate.id;

  const tView = await invite(tO, 'view', ['VIEW_CANDIDATES'], [job.id]);
  const tReview = await invite(tO, 'review', ['REVIEW_CANDIDATES'], [job.id]);

  step('1. View-only recruiter can see');
  const list = await call(`/applications/job/${job.id}`, { token: tView });
  assert(list.status === 200 && list.data.applications.length === 1, 'applicants on the assigned job');
  const detail = await call(`/applications/job/${job.id}/candidates/${candidateId}`, { token: tView });
  assert(detail.status === 200 && detail.data.application.id === application.id, 'candidate detail');
  const cv = await call(`/applications/job/${job.id}/candidates/${candidateId}/cv`, { token: tView, raw: true });
  assert(cv.status === 200 && (cv.headers.get('content-type') || '').includes('wordprocessingml'), 'opens the CV file');
  assert((cv.headers.get('content-disposition') || '').startsWith('inline'), 'inline by default');
  const dl = await call(`/applications/job/${job.id}/candidates/${candidateId}/cv?download=1`, { token: tView, raw: true });
  assert(dl.status === 200 && (dl.headers.get('content-disposition') || '').startsWith('attachment'), 'downloads the CV');
  const ivs = await call(`/interviews/job/${job.id}`, { token: tView });
  assert(ivs.status === 200, 'interview results list');

  step('2. View-only recruiter cannot act');
  const bulk = await call(`/applications/job/${job.id}/bulk-status`, { method: 'PATCH', token: tView, body: { applicationIds: [application.id], status: 'SHORTLISTED' } });
  assert(bulk.status === 403 && bulk.json?.error === 'PERMISSION_DENIED', 'shortlist → 403');
  const rej = await call(`/applications/${application.id}/reject`, { method: 'PATCH', token: tView });
  assert(rej.status === 403, 'reject → 403');
  const scr = await call(`/screening/job/${job.id}/run`, { method: 'POST', token: tView });
  assert(scr.status === 403, 'run screening → 403');
  const sub = await call(`/submissions/applications/${application.id}`, { token: tView });
  assert(sub.status === 403, 'submission panel → 403');
  const pool = await call('/cv-pool', { token: tView });
  assert(pool.status === 403, 'CV pool → 403');

  step('3. Only assigned jobs');
  const notMine = await call(`/applications/job/${other.id}`, { token: tView });
  assert(notMine.status === 403 || notMine.status === 404, "another job's applicants → refused");
  const notMineCv = await call(`/applications/job/${other.id}/candidates/${candidateId}/cv`, { token: tView });
  assert(notMineCv.status === 403 || notMineCv.status === 404, "and that job's CVs");

  step('4. Review recruiter and owner unchanged');
  const rList = await call(`/applications/job/${job.id}`, { token: tReview });
  assert(rList.status === 200, 'review recruiter sees applicants');
  const rCv = await call(`/applications/job/${job.id}/candidates/${candidateId}/cv`, { token: tReview, raw: true });
  assert(rCv.status === 200, 'review recruiter opens the CV');
  const rBulk = await call(`/applications/job/${job.id}/bulk-status`, { method: 'PATCH', token: tReview, body: { applicationIds: [application.id], status: 'SHORTLISTED' } });
  assert(rBulk.status === 200, 'review recruiter can still shortlist');
  const oCv = await call(`/applications/job/${job.id}/candidates/${candidateId}/cv`, { token: tO, raw: true });
  assert(oCv.status === 200, 'owner opens the CV');
  const candCv = await call(`/applications/job/${job.id}/candidates/${candidateId}/cv`, { token: cand.token });
  assert(candCv.status === 403, 'a candidate cannot use the agency CV route');

  console.log(`\nVIEW-ONLY RECRUITER TESTS PASSED ✔  (${passed} checks)`);
}

main().catch((err) => {
  console.error(`\nVIEW-ONLY RECRUITER TEST FAILED after ${passed} passing checks:`, err.message);
  process.exitCode = 1;
});
