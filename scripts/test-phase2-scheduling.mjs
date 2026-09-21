// Full Phase 2 flow: company shortlists/rejects (emails fire) -> candidate
// sees status -> shortlisted candidate schedules an interview -> slot
// becomes unavailable to others -> reschedule -> company marks completed.
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

console.log('== Setup: company + job + two candidates ==');
const companyEmail = `p2-company-${ts}@test.com`;
const { token: companyToken } = await req('/auth/register/company', {
  method: 'POST',
  body: { email: companyEmail, password: 'password123', companyName: 'Phase2 Test Co' },
});
const { job } = await req('/jobs', {
  method: 'POST',
  token: companyToken,
  body: {
    title: 'React Developer',
    description: 'React developer needed. Skills: React, JavaScript, HTML, CSS.',
    minimumExperience: 0,
    requiredSkills: ['React', 'JavaScript'],
    status: 'OPEN',
  },
});

async function registerCandidate(label) {
  const email = `p2-candidate-${label}-${ts}@test.com`;
  const { token } = await req('/auth/register/candidate', {
    method: 'POST',
    body: { email, password: 'password123', fullName: `Candidate ${label}` },
  });
  return { email, token };
}

const candA = await registerCandidate('A');
const candB = await registerCandidate('B');

const docxPath = process.argv[2];
if (!docxPath) throw new Error('Usage: node test-phase2-scheduling.mjs <path-to-resume.docx>');
const { readFileSync } = await import('fs');
const docxBuffer = readFileSync(docxPath);

// req() sets a JSON Content-Type whenever `body` is present, which breaks
// multipart uploads — bypass it for the resume upload specifically.
async function uploadResume(token) {
  const form = new FormData();
  form.append('resume', new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'resume.docx');
  const res = await fetch(`${BASE}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.data.resume;
}

const resumeA = await uploadResume(candA.token);
const { application: appA } = await req('/applications', { method: 'POST', token: candA.token, body: { jobId: job.id, resumeId: resumeA.id } });

const resumeB = await uploadResume(candB.token);
const { application: appB } = await req('/applications', { method: 'POST', token: candB.token, body: { jobId: job.id, resumeId: resumeB.id } });

console.log('\n== Company shortlists candidate A, rejects candidate B (emails should fire) ==');
const shortlistResult = await req(`/applications/job/${job.id}/bulk-status`, {
  method: 'PATCH',
  token: companyToken,
  body: { applicationIds: [appA.id], status: 'SHORTLISTED' },
});
assert(shortlistResult.updatedCount === 1, 'candidate A shortlisted');

const rejectResult = await req(`/applications/job/${job.id}/bulk-status`, {
  method: 'PATCH',
  token: companyToken,
  body: { applicationIds: [appB.id], status: 'REJECTED' },
});
assert(rejectResult.updatedCount === 1, 'candidate B rejected');

console.log('\n== Candidate A sees SHORTLISTED status ==');
const { application: appAView } = await req(`/applications/mine/${appA.id}`, { token: candA.token });
assert(appAView.status === 'SHORTLISTED', 'candidate A status is SHORTLISTED');

console.log('\n== Company creates 2 interview slots ==');
const now = Date.now();
const slot1Start = new Date(now + 24 * 3600 * 1000).toISOString();
const slot1End = new Date(now + 24 * 3600 * 1000 + 30 * 60 * 1000).toISOString();
const slot2Start = new Date(now + 25 * 3600 * 1000).toISOString();
const slot2End = new Date(now + 25 * 3600 * 1000 + 30 * 60 * 1000).toISOString();

const { slots: createdSlots } = await req(`/scheduling/jobs/${job.id}/slots`, {
  method: 'POST',
  token: companyToken,
  body: { slots: [{ startTime: slot1Start, endTime: slot1End }, { startTime: slot2Start, endTime: slot2End }] },
});
assert(createdSlots.length === 2, 'created 2 slots');

console.log('\n== Candidate A sees available slots ==');
const { slots: available } = await req(`/scheduling/applications/${appA.id}/slots`, { token: candA.token });
assert(available.length === 2, 'candidate A sees 2 available slots');

console.log('\n== Candidate A books the first slot ==');
const { interview: booked } = await req(`/scheduling/applications/${appA.id}/book`, {
  method: 'POST',
  token: candA.token,
  body: { slotId: createdSlots[0].id },
});
assert(booked.status === 'SCHEDULED', 'interview created with status SCHEDULED');

const { application: appAAfterBook } = await req(`/applications/mine/${appA.id}`, { token: candA.token });
assert(appAAfterBook.status === 'INTERVIEW_SCHEDULED', 'application status is now INTERVIEW_SCHEDULED');

console.log('\n== Booked slot is now unavailable to other candidates (shown as BOOKED, not hidden) ==');
const { slots: slotsAfterBooking } = await req(`/scheduling/applications/${appA.id}/slots`, { token: candA.token });
assert(slotsAfterBooking.length === 2, 'both slots still returned (candidate UI shows booked ones greyed out, not hidden)');
const bookedEntry = slotsAfterBooking.find((s) => s.id === createdSlots[0].id);
assert(bookedEntry.status === 'BOOKED', 'the booked slot is marked BOOKED, not AVAILABLE');
assert(slotsAfterBooking.filter((s) => s.status === 'AVAILABLE').length === 1, 'exactly 1 slot is still AVAILABLE');

console.log('\n== Trying to book the SAME slot again fails (race/double-booking guard) ==');
let doubleBookFailed = false;
try {
  await req(`/scheduling/applications/${appA.id}/book`, { method: 'POST', token: candA.token, body: { slotId: createdSlots[0].id } });
} catch (err) {
  doubleBookFailed = true;
}
assert(doubleBookFailed, 'booking an already-booked slot is rejected');

console.log('\n== Candidate A reschedules (cancel + rebook the other slot) ==');
await req(`/scheduling/applications/${appA.id}/cancel`, { method: 'POST', token: candA.token });
const { application: appAAfterCancel } = await req(`/applications/mine/${appA.id}`, { token: candA.token });
assert(appAAfterCancel.status === 'SHORTLISTED', 'application reverted to SHORTLISTED after cancelling');

const { slots: slotsAfterCancel } = await req(`/scheduling/applications/${appA.id}/slots`, { token: candA.token });
assert(slotsAfterCancel.every((s) => s.status === 'AVAILABLE'), 'both slots are AVAILABLE again after cancelling');

const { interview: rebooked } = await req(`/scheduling/applications/${appA.id}/book`, {
  method: 'POST',
  token: candA.token,
  body: { slotId: createdSlots[1].id },
});
assert(rebooked.status === 'SCHEDULED', 'rebooked the second slot successfully');

console.log('\n== Company sees the booking on the Interviews page ==');
const { slots: companySlots } = await req(`/scheduling/jobs/${job.id}/slots`, { token: companyToken });
const bookedSlot = companySlots.find((s) => s.id === createdSlots[1].id);
assert(bookedSlot.interviews.length === 1, 'company sees the interview on the slot');
assert(bookedSlot.interviews[0].application.candidate.fullName === 'Candidate A', 'company sees the correct candidate name');

console.log('\n== Company marks the interview completed ==');
await req(`/scheduling/jobs/${job.id}/interviews/${bookedSlot.interviews[0].id}/complete`, { method: 'PATCH', token: companyToken });
const { application: appAFinal } = await req(`/applications/mine/${appA.id}`, { token: candA.token });
assert(appAFinal.status === 'INTERVIEW_COMPLETED', 'application status is INTERVIEW_COMPLETED');

const { interview: finalInterview } = await req(`/scheduling/applications/${appA.id}/interview`, { token: candA.token });
assert(finalInterview.status === 'COMPLETED', 'interview record shows COMPLETED');

console.log('\nALL PHASE 2 TESTS PASSED ✔');
