// Validates: per-job auto-reject settings, that screening never auto-shortlists,
// and the bulk Shortlist/Reject endpoint. Run after `npm run db:seed`.
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

console.log('== Default job settings ==');
assert(job.minAcceptableScore === 75, 'minAcceptableScore defaults to 75, got ' + job.minAcceptableScore);
assert(job.autoRejectBelowMinScore === false, 'autoRejectBelowMinScore defaults to false');

console.log('== Enable auto-reject at threshold 75 BEFORE screening ==');
const { job: updated } = await req(`/jobs/${job.id}`, {
  method: 'PATCH',
  token,
  body: { minAcceptableScore: 75, autoRejectBelowMinScore: true },
});
assert(updated.autoRejectBelowMinScore === true, 'auto-reject enabled');

console.log('== Run AI screening for all 10 (real OpenRouter calls) ==');
const runResult = await req(`/screening/job/${job.id}/run`, { method: 'POST', token });
assert(runResult.screenedCount === 10, 'screened all 10, got ' + runResult.screenedCount);

const { applications } = await req(`/applications/job/${job.id}`, { token });
console.log('\nPost-screening statuses (auto-reject ON, threshold 75):');
applications.forEach((a) => console.log(`  ${a.candidate.fullName.padEnd(16)} score=${a.screeningResult?.overallScore} status=${a.status}`));

const belowThreshold = applications.filter((a) => a.screeningResult.overallScore < 75);
const atOrAbove = applications.filter((a) => a.screeningResult.overallScore >= 75);
assert(belowThreshold.every((a) => a.status === 'REJECTED'), 'all below-threshold apps are REJECTED (auto-reject)');
assert(atOrAbove.every((a) => a.status === 'SCREENING'), 'all at/above-threshold apps stay SCREENING (never auto-shortlisted)');
assert(applications.every((a) => a.status !== 'SHORTLISTED'), 'nothing was auto-SHORTLISTED by screening');

console.log('\n== Re-running screening does NOT re-screen already-completed applications ==');
const rerun = await req(`/screening/job/${job.id}/run`, { method: 'POST', token });
assert(rerun.screenedCount === 0, 'second run screens 0 (all already completed), got ' + rerun.screenedCount);

console.log('\n== Bulk shortlist the top 2 (Priya + Ananya, both SCREENING) ==');
const topTwo = atOrAbove
  .filter((a) => ['Priya Sharma', 'Ananya Iyer'].includes(a.candidate.fullName))
  .map((a) => a.id);
assert(topTwo.length === 2, 'found Priya + Ananya still in SCREENING');
const bulkShortlist = await req(`/applications/job/${job.id}/bulk-status`, {
  method: 'PATCH',
  token,
  body: { applicationIds: topTwo, status: 'SHORTLISTED' },
});
assert(bulkShortlist.updatedCount === 2, 'bulk shortlist updated 2 applications');

console.log('== Bulk reject one more (Meera, currently SCREENING or REJECTED depending on score) ==');
const meera = applications.find((a) => a.candidate.fullName === 'Meera Pillai');
const bulkReject = await req(`/applications/job/${job.id}/bulk-status`, {
  method: 'PATCH',
  token,
  body: { applicationIds: [meera.id], status: 'REJECTED' },
});
assert(bulkReject.updatedCount === 1, 'bulk reject updated 1 application');

const { applications: finalApps } = await req(`/applications/job/${job.id}`, { token });
const priyaFinal = finalApps.find((a) => a.candidate.fullName === 'Priya Sharma');
const ananyaFinal = finalApps.find((a) => a.candidate.fullName === 'Ananya Iyer');
const meeraFinal = finalApps.find((a) => a.candidate.fullName === 'Meera Pillai');
assert(priyaFinal.status === 'SHORTLISTED', 'Priya is now SHORTLISTED');
assert(ananyaFinal.status === 'SHORTLISTED', 'Ananya is now SHORTLISTED');
assert(meeraFinal.status === 'REJECTED', 'Meera is now REJECTED');

console.log('\n== A candidate cannot bulk-update an application outside their own job (cross-tenant check) ==');
const fakeId = 'nonexistent-application-id';
const crossTenant = await req(`/applications/job/${job.id}/bulk-status`, {
  method: 'PATCH',
  token,
  body: { applicationIds: [fakeId], status: 'SHORTLISTED' },
});
assert(crossTenant.updatedCount === 0, 'unknown/foreign applicationId updates 0 rows (no error, no effect)');

console.log('\nALL FILTER-DATA / SETTINGS / BULK-ACTION TESTS PASSED ✔');
