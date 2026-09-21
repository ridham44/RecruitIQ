// Manual end-to-end smoke test for the Phase 1 acceptance flow (Section 26).
// Not part of the app itself — run with: node scripts/e2e-test.mjs
import fs from 'fs';

const BASE = 'http://localhost:3001/api/v1';
const ts = Date.now();

async function req(path, { method = 'GET', body, token, isForm = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
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

async function main() {
  console.log('== 1. Company registers ==');
  const companyEmail = `company-${ts}@test.com`;
  const { user: companyUser, token: companyToken } = await req('/auth/register/company', {
    method: 'POST',
    body: { email: companyEmail, password: 'password123', companyName: 'Acme Corp', location: 'Remote' },
  });
  assert(companyUser.role === 'COMPANY', 'company registered with COMPANY role');

  console.log('== 2. Company logs in ==');
  const loginCompany = await req('/auth/login', { method: 'POST', body: { email: companyEmail, password: 'password123' } });
  assert(loginCompany.token, 'company login returned a token');

  console.log('== 3. Creates React Developer job ==');
  const { job } = await req('/jobs', {
    method: 'POST',
    token: companyToken,
    body: {
      title: 'React Developer',
      description:
        'We are looking for a React Developer with strong JavaScript, HTML, CSS skills and Node.js experience. ' +
        'Minimum 1 year of experience required. Computer Science degree preferred.',
      minimumExperience: 1,
      maximumExperience: 4,
      requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS'],
      preferredSkills: ['Node.js', 'MongoDB'],
      educationRequirements: ['Computer Science'],
      location: 'Remote',
      employmentType: 'FULL_TIME',
      status: 'OPEN',
    },
  });
  assert(job.id, 'job created: ' + job.id);
  console.log('  structuredRequirements:', JSON.stringify(job.structuredRequirements));

  console.log('== 4. Candidate registers ==');
  const candidateEmail = `candidate-${ts}@test.com`;
  const { user: candidateUser, token: candidateToken } = await req('/auth/register/candidate', {
    method: 'POST',
    body: { email: candidateEmail, password: 'password123', fullName: 'Jane Doe', phone: '+919876543210' },
  });
  assert(candidateUser.role === 'CANDIDATE', 'candidate registered with CANDIDATE role');

  console.log('== 5. Candidate logs in ==');
  const loginCandidate = await req('/auth/login', { method: 'POST', body: { email: candidateEmail, password: 'password123' } });
  assert(loginCandidate.token, 'candidate login returned a token');

  console.log('== 6. Candidate views job ==');
  const { jobs: openJobs } = await req('/jobs');
  assert(openJobs.some((j) => j.id === job.id), 'job visible in open jobs listing');
  const { job: jobDetail } = await req(`/jobs/${job.id}`);
  assert(jobDetail.title === 'React Developer', 'candidate can view job detail');

  console.log('== 7/8. Candidate uploads resume (DOCX) ==');
  const docxPath = process.argv[2];
  const docxBuffer = fs.readFileSync(docxPath);
  const form = new FormData();
  form.append('resume', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'resume.docx');
  const { resume } = await req('/resumes', { method: 'POST', token: candidateToken, body: form, isForm: true });
  assert(resume.id, 'resume uploaded: ' + resume.id);
  assert(resume.rawText && resume.rawText.length > 0, 'resume text extracted (' + resume.rawText.length + ' chars)');
  console.log('  parsedData:', JSON.stringify(resume.parsedData));

  console.log('== Candidate applies ==');
  const { application } = await req('/applications', {
    method: 'POST',
    token: candidateToken,
    body: { jobId: job.id, resumeId: resume.id },
  });
  assert(application.status === 'APPLIED', 'application created with APPLIED status');

  console.log('== Candidate sees application status ==');
  const { application: myApp } = await req(`/applications/mine/${application.id}`, { token: candidateToken });
  assert(myApp.status === 'APPLIED', 'candidate can view own application status');

  console.log('== Company opens applications ==');
  const { applications: companyApps } = await req(`/applications/job/${job.id}`, { token: companyToken });
  assert(companyApps.length === 1, 'company sees 1 application for the job');

  console.log('== Company runs AI screening ==');
  const screenResult = await req(`/screening/job/${job.id}/run`, { method: 'POST', token: companyToken });
  console.log('  screening run result:', JSON.stringify(screenResult));
  assert(screenResult.screenedCount === 1, 'screening ran for 1 application');

  console.log('== Company views ranked candidates / top 10 ==');
  const ranked = await req(`/screening/job/${job.id}/ranked`, { token: companyToken });
  assert(ranked.ranked.length === 1, 'ranked list contains the screened application');
  const rankedApp = ranked.ranked[0].application;
  console.log('  overallScore:', rankedApp.screeningResult?.overallScore, 'status:', rankedApp.screeningResult?.status);
  assert(rankedApp.screeningResult?.status === 'COMPLETED', 'screening completed successfully');
  assert(typeof rankedApp.screeningResult?.overallScore === 'number', 'overallScore is a number');

  const top10 = await req(`/screening/job/${job.id}/top`, { token: companyToken });
  assert(top10.ranked.length <= 10, 'top10 endpoint caps at 10');

  console.log('== Company opens candidate detail ==');
  const { application: candidateDetail } = await req(`/applications/job/${job.id}/candidates/${candidateUser.candidate?.id || myApp.candidateId}`, {
    token: companyToken,
  });
  assert(candidateDetail.resume?.rawText, 'candidate detail includes resume text');
  assert(candidateDetail.screeningResult?.reasoning !== undefined, 'candidate detail includes AI reasoning field');
  console.log('  matchedSkills:', candidateDetail.screeningResult?.matchedSkills);
  console.log('  missingSkills:', candidateDetail.screeningResult?.missingSkills);
  console.log('  reasoning:', candidateDetail.screeningResult?.reasoning);

  console.log('== Verify final application status updated by screening ==');
  const { application: finalApp } = await req(`/applications/mine/${application.id}`, { token: candidateToken });
  assert(['SHORTLISTED', 'REJECTED'].includes(finalApp.status), 'application status moved to SHORTLISTED or REJECTED: ' + finalApp.status);

  console.log('\nALL ACCEPTANCE CRITERIA PASSED ✔');
}

main().catch((err) => {
  console.error('\nE2E TEST FAILED:', err);
  process.exit(1);
});
