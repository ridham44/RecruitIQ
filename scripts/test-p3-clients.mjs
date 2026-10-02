// Build plan P3 acceptance test (docs/implementation-plan.html "Done when"):
//   - create Client → IT dept → HR person, create a job linked to them, see it on the job
//   - a job with only title + description can still be created (screening/interview
//     of such jobs is covered by smoke-current-flow.mjs)
// Plus: chain validation, soft deactivation, client filter, recruiter client
// scope, MANAGE_CLIENTS gating, cross-company isolation, public job API
// doesn't leak client details.
//
// Run against the dev server: node scripts/test-p3-clients.mjs
const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ts = Date.now();
const PASSWORD = 'password123';
let passed = 0;

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
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
const job = (title, extra = {}) => ({ title, description: `${title} — P3 client linkage test job.`, status: 'OPEN', ...extra });

async function main() {
  step('0. Setup: owner A, owner B, recruiter R in A (no MANAGE_CLIENTS)');
  const a = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p3-owner-a-${ts}@test.com`, password: PASSWORD, companyName: `P3 Agency A ${ts}` },
  });
  const b = await req('/auth/register/company', {
    method: 'POST',
    body: { email: `p3-owner-b-${ts}@test.com`, password: PASSWORD, companyName: `P3 Agency B ${ts}` },
  });
  const inv = await req('/recruiters', {
    method: 'POST',
    token: a.token,
    body: { email: `p3-rec-${ts}@test.com`, fullName: 'P3 Recruiter', permissions: ['REVIEW_CANDIDATES'] },
  });
  const rId = inv.recruiter.id;
  const tR = (await req('/auth/set-password', { method: 'POST', body: { token: new URL(inv.setupLink).searchParams.get('token'), password: PASSWORD } })).token;

  // step('1. Client → departments → HR people');
  step('1. Company (client) → departments + Company HR');
  const { client: c1 } = await req('/clients', {
    method: 'POST',
    token: a.token,
    body: { name: `Infotech ${ts}`, industry: 'IT services', contactName: 'Asha', contactEmail: 'ASHA@Infotech.test', website: 'https://infotech.test' },
  });
  assert(c1.isActive && c1.contactEmail === 'asha@infotech.test', 'client created (contact email normalized)');
  const badUrl = await call('/clients', { method: 'POST', token: a.token, body: { name: 'Bad', website: 'not a url' } });
  assert(badUrl.status === 400, 'invalid website rejected');
  let { client } = await req(`/clients/${c1.id}/departments`, { method: 'POST', token: a.token, body: { name: 'IT' } });
  ({ client } = await req(`/clients/${c1.id}/departments`, { method: 'POST', token: a.token, body: { name: 'Finance' } }));
  const dup = await call(`/clients/${c1.id}/departments`, { method: 'POST', token: a.token, body: { name: 'IT' } });
  assert(dup.status === 409, 'duplicate department name → 409');
  const it = client.departments.find((d) => d.name === 'IT');
  const fin = client.departments.find((d) => d.name === 'Finance');
  ({ client } = await req(`/clients/departments/${it.id}/hiring-persons`, {
    method: 'POST',
    token: a.token,
    body: { fullName: 'Harish HR', email: 'harish@infotech.test', designation: 'IT Hiring Manager' },
  }));
  ({ client } = await req(`/clients/departments/${fin.id}/hiring-persons`, {
    method: 'POST',
    token: a.token,
    body: { fullName: 'Fatima Finance', email: 'fatima@infotech.test' },
  }));
  // const h1 = client.departments.find((d) => d.id === it.id).hiringPersons[0];
  // const h2 = client.departments.find((d) => d.id === fin.id).hiringPersons[0];
  // assert(h1.fullName === 'Harish HR' && h2.fullName === 'Fatima Finance', 'HR people added under their departments');
  // Company HR now belong to the company; the department is an optional label.
  const h1 = client.hiringPersons.find((p) => p.fullName === 'Harish HR');
  const h2 = client.hiringPersons.find((p) => p.fullName === 'Fatima Finance');
  assert(h1?.department?.name === 'IT' && h2?.department?.name === 'Finance', 'HR people added (old department route still works, department kept as a label)');
  ({ client } = await req(`/clients/${c1.id}/hiring-persons`, { method: 'POST', token: a.token, body: { fullName: 'Gita General', email: 'gita@infotech.test' } }));
  const h3 = client.hiringPersons.find((p) => p.fullName === 'Gita General');
  assert(h3 && h3.departmentId === null && client.hiringPersons.length === 3, 'Company HR can be added directly to the company, without a department');
  const badDept = await call(`/clients/${c1.id}/hiring-persons`, { method: 'POST', token: a.token, body: { fullName: 'X', email: 'x@infotech.test', departmentId: 'nope' } });
  assert(badDept.status === 400, 'a department from elsewhere is rejected');
  ({ client } = await req(`/clients/hiring-persons/${h3.id}`, { method: 'PATCH', token: a.token, body: { departmentId: fin.id } }));
  assert(client.hiringPersons.find((p) => p.id === h3.id)?.department?.name === 'Finance', 'department label can be set later');
  ({ client } = await req(`/clients/hiring-persons/${h3.id}`, { method: 'PATCH', token: a.token, body: { departmentId: null } }));
  assert(client.hiringPersons.find((p) => p.id === h3.id)?.departmentId === null, 'and cleared again');
  const { clients } = await req('/clients', { token: a.token });
  assert(clients.some((c) => c.id === c1.id && c.departmentCount === 2), 'client list shows department count');

  step('2. Job linked to Client → IT → HR person');
  const { job: j1 } = await req('/jobs', {
    method: 'POST',
    token: a.token,
    body: job('P3 Linked Job', { clientCompanyId: c1.id, departmentId: it.id, hiringPersonId: h1.id }),
  });
  const { link } = await req(`/jobs/${j1.id}/client-link`, { token: a.token });
  assert(link.clientCompany.name === `Infotech ${ts}` && link.department.name === 'IT' && link.hiringPerson.fullName === 'Harish HR', 'job shows its client, department and HR person');
  const { jobs: listed } = await req('/jobs/company/mine', { token: a.token });
  assert(listed.find((j) => j.id === j1.id)?.clientCompany?.name === `Infotech ${ts}`, 'job list includes the client name');
  const pub = await req(`/jobs/${j1.id}`);
  assert(!pub.job.clientCompany && !pub.job.hiringPerson, 'public job API does not expose client or HR details');

  step('3. Title + description only still works');
  const { job: j0 } = await req('/jobs', { method: 'POST', token: a.token, body: { title: 'P3 Plain Job', description: 'Only a title and a description.' } });
  assert(j0.id && j0.clientCompanyId === null, 'plain job created with no client');

  step('4. Chain validation');
  // const wrongDept = await call('/jobs', { method: 'POST', token: a.token, body: job('Bad', { clientCompanyId: c1.id, departmentId: fin.id, hiringPersonId: h1.id }) });
  // assert(wrongDept.status === 400 && wrongDept.json?.error === 'INVALID_CLIENT_CHAIN', 'HR person from another department → 400 INVALID_CLIENT_CHAIN');
  // HR only has to belong to the same company now.
  let { client: c2 } = await req('/clients', { method: 'POST', token: a.token, body: { name: `Other Co ${ts}` } });
  ({ client: c2 } = await req(`/clients/${c2.id}/hiring-persons`, { method: 'POST', token: a.token, body: { fullName: 'Otto Other', email: 'otto@other.test' } }));
  const wrongCo = await call('/jobs', { method: 'POST', token: a.token, body: job('Bad', { clientCompanyId: c1.id, hiringPersonId: c2.hiringPersons[0].id }) });
  assert(wrongCo.status === 400 && wrongCo.json?.error === 'INVALID_CLIENT_CHAIN', 'HR person from another company → 400 INVALID_CLIENT_CHAIN');
  const hrNoCo = await call('/jobs', { method: 'POST', token: a.token, body: job('Bad', { hiringPersonId: h1.id }) });
  assert(hrNoCo.status === 400, 'HR person without a company → 400');
  const noClient = await call('/jobs', { method: 'POST', token: a.token, body: job('Bad', { departmentId: it.id }) });
  assert(noClient.status === 400, 'department without a client → 400');
  const { client: cB } = await req('/clients', { method: 'POST', token: b.token, body: { name: `B Client ${ts}` } });
  const foreign = await call('/jobs', { method: 'POST', token: a.token, body: job('Bad', { clientCompanyId: cB.id }) });
  assert(foreign.status === 400, "another agency's client → 400");

  step('5. Updating the link');
  await req(`/jobs/${j1.id}`, { method: 'PATCH', token: a.token, body: { departmentId: fin.id } });
  let l = (await req(`/jobs/${j1.id}/client-link`, { token: a.token })).link;
  // assert(l.department.name === 'Finance' && l.hiringPerson === null, 'changing department clears the old HR person');
  assert(l.department.name === 'Finance' && l.hiringPerson?.fullName === 'Harish HR', 'changing department keeps the Company HR (HR is not tied to a department)');
  await req(`/jobs/${j1.id}`, { method: 'PATCH', token: a.token, body: { departmentId: null, hiringPersonId: h3.id } });
  l = (await req(`/jobs/${j1.id}/client-link`, { token: a.token })).link;
  assert(!l.department && l.hiringPerson?.fullName === 'Gita General', 'job can link Company HR with no department');
  await req(`/jobs/${j1.id}`, { method: 'PATCH', token: a.token, body: { departmentId: fin.id } });
  await req(`/jobs/${j1.id}`, { method: 'PATCH', token: a.token, body: { hiringPersonId: h2.id } });
  await req(`/jobs/${j1.id}`, { method: 'PATCH', token: a.token, body: { title: 'P3 Linked Job (renamed)' } });
  l = (await req(`/jobs/${j1.id}/client-link`, { token: a.token })).link;
  assert(l.hiringPerson?.fullName === 'Fatima Finance', 'unrelated edits keep the link');
  await req(`/jobs/${j1.id}`, { method: 'PATCH', token: a.token, body: { clientCompanyId: null } });
  l = (await req(`/jobs/${j1.id}/client-link`, { token: a.token })).link;
  assert(!l.clientCompany && !l.department && !l.hiringPerson, 'clearing the client clears the whole chain');
  await req(`/jobs/${j1.id}`, { method: 'PATCH', token: a.token, body: { clientCompanyId: c1.id, departmentId: it.id, hiringPersonId: h1.id } });

  step('6. Client filter on the job list');
  const { jobs: byClient } = await req(`/jobs/company/mine?clientId=${c1.id}`, { token: a.token });
  assert(byClient.length === 1 && byClient[0].id === j1.id, '?clientId= returns only that client\'s jobs');
  const { jobs: noneJobs } = await req('/jobs/company/mine?clientId=none', { token: a.token });
  assert(noneJobs.some((j) => j.id === j0.id) && !noneJobs.some((j) => j.id === j1.id), '?clientId=none returns jobs without a client');

  step('7. Soft deactivation');
  await req(`/clients/hiring-persons/${h1.id}/status`, { method: 'PATCH', token: a.token, body: { isActive: false } });
  const inactiveHr = await call('/jobs', { method: 'POST', token: a.token, body: job('Bad', { clientCompanyId: c1.id, departmentId: it.id, hiringPersonId: h1.id }) });
  assert(inactiveHr.status === 400, 'an inactive HR person cannot be chosen for a new job');
  const keep = await call(`/jobs/${j1.id}`, { method: 'PATCH', token: a.token, body: { openings: 2 } });
  assert(keep.status === 200, 'an existing job linked to them can still be edited');
  await req(`/clients/hiring-persons/${h1.id}/status`, { method: 'PATCH', token: a.token, body: { isActive: true } });
  await req(`/clients/${c1.id}/status`, { method: 'PATCH', token: a.token, body: { isActive: false } });
  const { clients: inactiveList } = await req('/clients?status=inactive', { token: a.token });
  assert(inactiveList.some((c) => c.id === c1.id), 'deactivated client is kept (listed as inactive)');
  await req(`/clients/${c1.id}/status`, { method: 'PATCH', token: a.token, body: { isActive: true } });

  step('8. Recruiter client scope + MANAGE_CLIENTS');
  const { clients: rBefore } = await req('/clients', { token: tR });
  assert(rBefore.length === 0, 'recruiter without MANAGE_CLIENTS sees no unassigned clients');
  assert((await call(`/applications/job/${j1.id}`, { token: tR })).status === 403, 'and has no access to the client job yet');
  const rCreate = await call('/clients', { method: 'POST', token: tR, body: { name: 'Nope' } });
  assert(rCreate.status === 403 && rCreate.json?.error === 'PERMISSION_DENIED', 'recruiter cannot create clients');
  await req(`/clients/${c1.id}/recruiters`, { method: 'PUT', token: a.token, body: { memberIds: [rId] } });
  const { clients: rAfter } = await req('/clients', { token: tR });
  assert(rAfter.length === 1 && rAfter[0].id === c1.id, 'after assignment the recruiter sees the client');
  const { jobs: rJobs } = await req('/jobs/company/mine', { token: tR });
  assert(rJobs.some((j) => j.id === j1.id), "and every job of that client");
  assert((await call(`/applications/job/${j1.id}`, { token: tR })).status === 200, 'and can review its applicants');
  const { members } = await req('/recruiters', { token: a.token });
  assert(members.find((m) => m.id === rId)?.clients?.[0]?.id === c1.id, 'recruiters list shows the client assignment');
  const rEdit = await call(`/clients/${c1.id}`, { method: 'PATCH', token: tR, body: { name: 'Renamed' } });
  assert(rEdit.status === 403, 'assigned recruiter still cannot edit the client without MANAGE_CLIENTS');

  step('9. Cross-agency isolation');
  assert((await call(`/clients/${c1.id}`, { token: b.token })).status === 404, "agency B can't read agency A's client");
  assert((await call(`/clients/${c1.id}/departments`, { method: 'POST', token: b.token, body: { name: 'X' } })).status === 404, "agency B can't add departments to it");
  assert((await call(`/clients/hiring-persons/${h1.id}`, { method: 'PATCH', token: b.token, body: { fullName: 'X' } })).status === 404, "agency B can't edit its HR people");
  assert((await call(`/clients/${c1.id}/recruiters`, { method: 'PUT', token: b.token, body: { memberIds: [] } })).status === 404, "agency B can't change its recruiters");

  console.log(`\nPHASE 3 TESTS PASSED ✔  (${passed} checks)`);
}

main().catch((err) => {
  console.error(`\nPHASE 3 TEST FAILED after ${passed} passing checks:`, err.message);
  process.exitCode = 1;
});
