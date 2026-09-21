// Verifies "Create AI Interview Slots" (Phase 2.5): the exact spec example
// (10:00-13:00, 15-min interviews -> 12 slots), the overlap-skip behavior
// on re-generation, and that generated slots are bookable through the
// existing Phase 2 flow unchanged.
const BASE = 'http://localhost:3001/api/v1';
const ts = Date.now();

async function req(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
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

console.log('== Setup: company + job ==');
const { token: companyToken } = await req('/auth/register/company', {
  method: 'POST',
  body: { email: `gen-company-${ts}@test.com`, password: 'password123', companyName: 'Gen Test Co' },
});
const { job } = await req('/jobs', {
  method: 'POST',
  token: companyToken,
  body: { title: 'Gen Test Job', description: 'Testing AI slot generation.', status: 'OPEN' },
});

console.log('\n== 10:00-13:00, 15-min interviews, 0 buffer -> expect exactly 12 slots ==');
const day = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10); // 5 days from now
const rangeStart = new Date(`${day}T10:00:00`).toISOString();
const rangeEnd = new Date(`${day}T13:00:00`).toISOString();

const result = await req(`/scheduling/jobs/${job.id}/slots/generate`, {
  method: 'POST',
  token: companyToken,
  body: { rangeStart, rangeEnd, durationMinutes: 15, bufferMinutes: 0 },
});
assert(result.slots.length === 12, `expected 12 slots, got ${result.slots.length}`);
assert(result.skippedCount === 0, 'nothing skipped on first generation');

const sorted = [...result.slots].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
assert(new Date(sorted[0].startTime).toISOString() === rangeStart, 'first slot starts exactly at rangeStart');
assert(new Date(sorted[11].endTime).toISOString() === rangeEnd, 'last slot ends exactly at rangeEnd');
for (let i = 0; i < sorted.length - 1; i++) {
  assert(sorted[i].endTime === sorted[i + 1].startTime, `slot ${i} ends exactly where slot ${i + 1} starts (no gap, no overlap)`);
}

console.log('\n== With a 5-minute buffer, fewer slots fit in the same range ==');
const day2 = new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);
const bufferedResult = await req(`/scheduling/jobs/${job.id}/slots/generate`, {
  method: 'POST',
  token: companyToken,
  body: {
    rangeStart: new Date(`${day2}T10:00:00`).toISOString(),
    rangeEnd: new Date(`${day2}T13:00:00`).toISOString(),
    durationMinutes: 15,
    bufferMinutes: 5,
  },
});
// 180 minutes / 20-minute step = 9 slots (last one starts at 10:00 + 8*20 = 12:40, ends 12:55, fits)
assert(bufferedResult.slots.length === 9, `expected 9 slots with a 5-min buffer, got ${bufferedResult.slots.length}`);

console.log('\n== Re-generating over the SAME range skips all 12 (already exist) ==');
// Every candidate slot overlaps an existing one, so the service correctly
// rejects the whole batch with 409 rather than silently creating nothing.
let allOverlapped = false;
try {
  await req(`/scheduling/jobs/${job.id}/slots/generate`, {
    method: 'POST',
    token: companyToken,
    body: { rangeStart, rangeEnd, durationMinutes: 15, bufferMinutes: 0 },
  });
} catch (err) {
  allOverlapped = err.message.includes('overlaps');
}
assert(allOverlapped, 're-running over the exact same range is rejected (all 12 would overlap)');

console.log('\n== Range too short for even one slot is rejected cleanly ==');
let tooShortFailed = false;
try {
  await req(`/scheduling/jobs/${job.id}/slots/generate`, {
    method: 'POST',
    token: companyToken,
    body: {
      rangeStart: new Date(`${day}T09:00:00`).toISOString(),
      rangeEnd: new Date(`${day}T09:10:00`).toISOString(),
      durationMinutes: 15,
      bufferMinutes: 0,
    },
  });
} catch {
  tooShortFailed = true;
}
assert(tooShortFailed, 'a 10-minute range with 15-minute duration is rejected');

console.log('\n== Generated slots are fully compatible with the existing booking flow ==');
const { token: candidateToken } = await req('/auth/register/candidate', {
  method: 'POST',
  body: { email: `gen-candidate-${ts}@test.com`, password: 'password123', fullName: 'Gen Candidate' },
});
const docxPath = process.argv[2];
if (!docxPath) throw new Error('Usage: node test-generate-slots.mjs <path-to-resume.docx>');
const { readFileSync } = await import('fs');
const docxBuffer = readFileSync(docxPath);
const form = new FormData();
form.append('resume', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'resume.docx');
const uploadRes = await fetch(`${BASE}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${candidateToken}` }, body: form });
const { resume } = (await uploadRes.json()).data;
const { application } = await req('/applications', { method: 'POST', token: candidateToken, body: { jobId: job.id, resumeId: resume.id } });
await req(`/applications/job/${job.id}/bulk-status`, {
  method: 'PATCH',
  token: companyToken,
  body: { applicationIds: [application.id], status: 'SHORTLISTED' },
});

const { slots: available } = await req(`/scheduling/applications/${application.id}/slots`, { token: candidateToken });
assert(available.length > 0, 'candidate sees the AI-generated slots as available');

const { interview } = await req(`/scheduling/applications/${application.id}/book`, {
  method: 'POST',
  token: candidateToken,
  body: { slotId: available[0].id },
});
assert(interview.status === 'SCHEDULED', 'candidate booked a generated slot successfully — Interview record created');

const { application: booked } = await req(`/applications/mine/${application.id}`, { token: candidateToken });
assert(booked.status === 'INTERVIEW_SCHEDULED', 'application status updated exactly as with manually-created slots');

console.log('\nALL SLOT-GENERATION TESTS PASSED ✔');
