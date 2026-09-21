// Verifies the actual concurrency guard: two DIFFERENT shortlisted
// candidates racing to book the exact same slot at the same time — only
// one must win.
const BASE = 'http://localhost:3001/api/v1';
const ts = Date.now();

async function req(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(json?.message || `HTTP ${res.status}`), { status: res.status });
  return json.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ok:', msg);
}

const { token: companyToken } = await req('/auth/register/company', {
  method: 'POST',
  body: { email: `race-company-${ts}@test.com`, password: 'password123', companyName: 'Race Test Co' },
});
const { job } = await req('/jobs', {
  method: 'POST',
  token: companyToken,
  body: { title: 'Race Test Job', description: 'Testing concurrent slot booking.', status: 'OPEN' },
});

// Need a resume + application to reach SHORTLISTED — build a minimal real resume.
const docxPath = process.argv[2];
if (!docxPath) throw new Error('Usage: node test-race-condition.mjs <path-to-resume.docx>');
const { readFileSync } = await import('fs');
const docxBuffer = readFileSync(docxPath);

async function setupShortlistedCandidate(label) {
  const { token } = await req('/auth/register/candidate', {
    method: 'POST',
    body: { email: `race-cand-${label}-${ts}@test.com`, password: 'password123', fullName: `Race Candidate ${label}` },
  });
  const form = new FormData();
  form.append('resume', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'resume.docx');
  const res = await fetch(`${BASE}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const { resume } = (await res.json()).data;
  const { application } = await req('/applications', { method: 'POST', token, body: { jobId: job.id, resumeId: resume.id } });
  await req(`/applications/job/${job.id}/bulk-status`, {
    method: 'PATCH',
    token: companyToken,
    body: { applicationIds: [application.id], status: 'SHORTLISTED' },
  });
  return { token, applicationId: application.id };
}

const candA = await setupShortlistedCandidate('A');
const candB = await setupShortlistedCandidate('B');

const start = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
const end = new Date(Date.now() + 48 * 3600 * 1000 + 30 * 60 * 1000).toISOString();
const { slots } = await req(`/scheduling/jobs/${job.id}/slots`, {
  method: 'POST',
  token: companyToken,
  body: { slots: [{ startTime: start, endTime: end }] },
});
const slotId = slots[0].id;

console.log('== Both candidates attempt to book the SAME slot concurrently ==');
const results = await Promise.allSettled([
  req(`/scheduling/applications/${candA.applicationId}/book`, { method: 'POST', token: candA.token, body: { slotId } }),
  req(`/scheduling/applications/${candB.applicationId}/book`, { method: 'POST', token: candB.token, body: { slotId } }),
]);

const succeeded = results.filter((r) => r.status === 'fulfilled');
const failed = results.filter((r) => r.status === 'rejected');

console.log(`  succeeded: ${succeeded.length}, failed: ${failed.length}`);
assert(succeeded.length === 1, 'exactly one candidate won the slot');
assert(failed.length === 1, 'exactly one candidate was rejected');
assert(failed[0].reason.status === 409, 'the loser got a 409 Conflict, not a crash');

console.log('\nRACE CONDITION GUARD VERIFIED ✔');
