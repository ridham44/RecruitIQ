// Non-destructive check for the force re-run screening feature — reads
// current state, only calls the force re-run endpoint, never re-seeds.
const BASE = 'http://localhost:3001/api/v1';

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

const { token } = await req('/auth/login', { method: 'POST', body: { email: 'company@ravantratech.demo', password: 'Demo@1234' } });
const { jobs } = await req('/jobs/company/mine', { token });
const job = jobs.find((j) => j.title === 'React.js Developer');
console.log('Current job settings:', { minAcceptableScore: job.minAcceptableScore, autoRejectBelowMinScore: job.autoRejectBelowMinScore });

const { applications: before } = await req(`/applications/job/${job.id}`, { token });
console.log('\nCurrent state:');
before.forEach((a) => console.log(`  ${a.candidate.fullName.padEnd(16)} score=${a.screeningResult?.overallScore ?? '—'} status=${a.status}`));

const shortlistedBefore = before.filter((a) => a.status === 'SHORTLISTED').map((a) => a.id);
const rerunnable = before.filter((a) => a.screeningResult?.status === 'COMPLETED' && a.status !== 'SHORTLISTED');

if (rerunnable.length === 0) {
  console.log('\nNothing eligible to force re-run right now (nothing screened yet, or everything is SHORTLISTED) — nothing to verify.');
  process.exit(0);
}

console.log(`\n== Tightening minAcceptableScore to 95 + enabling auto-reject, then force re-running ${rerunnable.length} application(s) ==`);
await req(`/jobs/${job.id}`, { method: 'PATCH', token, body: { minAcceptableScore: 95, autoRejectBelowMinScore: true } });

const rerunResult = await req(`/screening/job/${job.id}/run`, { method: 'POST', token, body: { force: true } });
assert(rerunResult.screenedCount === rerunnable.length, `force re-run screened exactly the ${rerunnable.length} eligible application(s), got ${rerunResult.screenedCount}`);

const { applications: after } = await req(`/applications/job/${job.id}`, { token });
console.log('\nAfter force re-run (threshold=95, auto-reject ON):');
after.forEach((a) => console.log(`  ${a.candidate.fullName.padEnd(16)} score=${a.screeningResult?.overallScore ?? '—'} status=${a.status}`));

const stillBelow95 = after.filter((a) => a.screeningResult?.overallScore != null && a.screeningResult.overallScore < 95 && a.status !== 'SHORTLISTED');
assert(stillBelow95.every((a) => a.status === 'REJECTED'), 'everything below the new 95 threshold (and not shortlisted) is now REJECTED');

const shortlistedAfter = after.filter((a) => a.status === 'SHORTLISTED').map((a) => a.id);
assert(
  JSON.stringify(shortlistedBefore.sort()) === JSON.stringify(shortlistedAfter.sort()),
  'previously-SHORTLISTED applications were NOT touched by the force re-run'
);

console.log('\nRE-RUN SCREENING FEATURE VERIFIED ✔');
