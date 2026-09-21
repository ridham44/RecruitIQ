const BASE = 'http://localhost:3001/api/v1';
const ts = Date.now();

async function req(path, { method = 'GET', body, token, isForm = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ok:', msg);
}

const email = `neg-${ts}@test.com`;
const { json: reg } = await req('/auth/register/candidate', { method: 'POST', body: { email, password: 'password123', fullName: 'Neg Test' } });
const token = reg.data.token;

console.log('== Invalid file type rejected ==');
const form = new FormData();
form.append('resume', new Blob([Buffer.from('not a real resume')], { type: 'text/plain' }), 'resume.txt');
const uploadRes = await req('/resumes', { method: 'POST', token, body: form, isForm: true });
assert(uploadRes.status === 400, 'txt upload rejected with 400, got ' + uploadRes.status);
assert(uploadRes.json.error === 'INVALID_FILE_TYPE', 'error code is INVALID_FILE_TYPE, got ' + uploadRes.json.error);
assert(uploadRes.json.success === false, 'response envelope has success:false');

console.log('== Wrong password rejected ==');
const badLogin = await req('/auth/login', { method: 'POST', body: { email, password: 'wrongpassword' } });
assert(badLogin.status === 401, 'wrong password rejected with 401, got ' + badLogin.status);

console.log('== Duplicate registration rejected ==');
const dup = await req('/auth/register/candidate', { method: 'POST', body: { email, password: 'password123', fullName: 'Dup' } });
assert(dup.status === 409, 'duplicate email rejected with 409, got ' + dup.status);

console.log('== Candidate cannot access company-only route ==');
const forbidden = await req('/jobs', { method: 'POST', token, body: { title: 'x' } });
assert(forbidden.status === 403, 'candidate posting a job rejected with 403, got ' + forbidden.status);

console.log('== No token rejected ==');
const noAuth = await req('/auth/me');
assert(noAuth.status === 401, 'no-token request rejected with 401, got ' + noAuth.status);

console.log('\nALL NEGATIVE TESTS PASSED ✔');
