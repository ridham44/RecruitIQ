// Manual validation script for the seeded Ravantra Technologies dataset:
// logs in as the demo company, runs real AI screening on all 10 seeded
// applications, and prints the ranking plus a gender-blindness spot check.
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

const { token } = await req('/auth/login', {
  method: 'POST',
  body: { email: 'company@ravantratech.demo', password: 'Demo@1234' },
});

const { jobs } = await req('/jobs/company/mine', { token });
const job = jobs.find((j) => j.title === 'React.js Developer');
console.log('Job:', job.id, job.title);

console.log('\nRunning AI screening for all applications (this calls OpenRouter 10 times)...');
const runResult = await req(`/screening/job/${job.id}/run`, { method: 'POST', token });
console.log('Screened:', runResult.screenedCount);

const ranked = await req(`/screening/job/${job.id}/ranked`, { token });

console.log('\n=== RANKING (job-relevant qualifications only, gender never sent to the model) ===\n');
ranked.ranked.forEach(({ rank, application }) => {
  const r = application.screeningResult;
  console.log(
    `#${rank}  ${application.candidate.fullName.padEnd(16)} score=${r.overallScore}  ` +
      `skill=${r.skillMatchScore} exp=${r.experienceMatchScore} edu=${r.educationMatchScore}  status=${application.status}`
  );
});

const ridham = ranked.ranked.find((r) => r.application.candidate.fullName === 'Ridham Patel');
const stronger = ranked.ranked.filter(
  (r) => ['Priya Sharma', 'Ananya Iyer'].includes(r.application.candidate.fullName)
);

console.log(`\nRidham Patel: rank #${ridham.rank}, score ${ridham.application.screeningResult.overallScore}`);
stronger.forEach((s) =>
  console.log(`${s.application.candidate.fullName}: rank #${s.rank}, score ${s.application.screeningResult.overallScore}`)
);

const bothOutrankRidham = stronger.every((s) => s.application.screeningResult.overallScore > ridham.application.screeningResult.overallScore);
console.log(`\nBoth Priya and Ananya outrank Ridham (by score): ${bothOutrankRidham ? 'YES' : 'NO'}`);
