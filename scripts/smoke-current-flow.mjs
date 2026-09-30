// Phase 0 safety net (docs/implementation-plan.html): walks today's happy
// path through the API so every later phase can prove it broke nothing.
//
//   register company → create job → register candidate → upload CV → apply →
//   run screening → shortlist → generate slot → book → start interview →
//   answer → end → report
//
// Run it at the end of every phase against a running server (npm run dev):
//   node scripts/smoke-current-flow.mjs [path-to-resume.pdf|.docx]
//
// Without a path it builds a small .docx resume in memory, so it needs no
// fixture file. SMOKE_BASE_URL overrides the API base (default localhost).
// Screening and the interview report call the real AI (OpenRouter), so
// OPENROUTER_API_KEY must be set in .env. Phone interviews aren't covered.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const ts = Date.now();
const PASSWORD = 'password123';

let passed = 0;

async function req(apiPath, { method = 'GET', body, token, isForm = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${apiPath}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`  FAIL ${method} ${apiPath} -> ${res.status}`, JSON.stringify(json));
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return json?.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  passed++;
  console.log('  ok:', msg);
}

function step(title) {
  console.log(`\n== ${title} ==`);
}

// Minimal .docx (an uncompressed zip of three XML parts) with one paragraph
// per line, so mammoth and the resume analyzer have real text to read. Built
// by hand to avoid needing a fixture file or a zip dependency.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(text, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

function buildResumeDocx(lines) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = lines.map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join('');
  return zipStore({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
    'word/document.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body>${body}</w:body></w:document>`,
  });
}

function loadResume() {
  const arg = process.argv[2];
  if (arg) {
    const ext = path.extname(arg).toLowerCase();
    const type =
      ext === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return { buffer: fs.readFileSync(arg), type, name: `resume${ext}` };
  }
  const buffer = buildResumeDocx([
    'Jane Smoke',
    `jane.smoke.${ts}@test.com  |  +91 98765 43210  |  Pune, India`,
    '',
    'SUMMARY',
    'Frontend developer with 3 years of experience building React applications.',
    '',
    'SKILLS',
    'React, JavaScript, TypeScript, HTML, CSS, Node.js, REST APIs, Git',
    '',
    'EXPERIENCE',
    'Frontend Developer - Acme Software (2022 - Present)',
    '- Built a React + Redux dashboard used by 5,000 daily users.',
    '- Integrated REST APIs and cut page load time by 40%.',
    'Junior Developer - Webworks (2021 - 2022)',
    '- Built responsive pages with HTML, CSS and JavaScript.',
    '',
    'EDUCATION',
    'B.E. Computer Science - Pune University (2021)',
  ]);
  return {
    buffer,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    name: 'resume.docx',
  };
}

async function main() {
  console.log(`Smoke test against ${API}`);

  step('0. Server is up');
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  assert(health?.ok, `GET /api/health responds (${health?.status ?? 'no response'})`);

  step('1. Company registers and logs in');
  const companyEmail = `smoke-company-${ts}@test.com`;
  const registeredCompany = await req('/auth/register/company', {
    method: 'POST',
    body: { email: companyEmail, password: PASSWORD, companyName: `Smoke Co ${ts}`, location: 'Remote' },
  });
  assert(registeredCompany.user.role === 'COMPANY', 'company registered with COMPANY role');
  const { token: companyToken } = await req('/auth/login', {
    method: 'POST',
    body: { email: companyEmail, password: PASSWORD },
  });
  assert(companyToken, 'company login returned a token');
  const me = await req('/auth/me', { token: companyToken });
  assert(me.user?.email === companyEmail || me.email === companyEmail, '/auth/me returns the company user');

  step('2. Company creates a job');
  const { job } = await req('/jobs', {
    method: 'POST',
    token: companyToken,
    body: {
      title: 'React Developer',
      description:
        'We are hiring a React Developer with strong JavaScript, HTML and CSS skills and REST API experience. ' +
        'Node.js is a plus. 1-4 years of experience. Computer Science degree preferred.',
      minimumExperience: 1,
      maximumExperience: 4,
      requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS'],
      preferredSkills: ['Node.js'],
      educationRequirements: ['Computer Science'],
      location: 'Remote',
      employmentType: 'FULL_TIME',
      status: 'OPEN',
    },
  });
  assert(job?.id, `job created (${job.id})`);
  const { config } = await req(`/interviews/config/${job.id}`, { token: companyToken });
  assert(config && typeof config.questionCount === 'number', 'default AI interviewer config is readable');

  step('3. Candidate registers and sees the job');
  const candidateEmail = `smoke-candidate-${ts}@test.com`;
  const { token: candidateToken } = await req('/auth/register/candidate', {
    method: 'POST',
    body: { email: candidateEmail, password: PASSWORD, fullName: 'Jane Smoke', phone: '+919876543210' },
  });
  assert(candidateToken, 'candidate registered and got a token');
  const { jobs: openJobs } = await req('/jobs');
  assert(openJobs.some((j) => j.id === job.id), 'job appears in the open jobs listing');

  step('4. Candidate uploads a CV');
  const file = loadResume();
  const form = new FormData();
  form.append('resume', new Blob([file.buffer], { type: file.type }), file.name);
  const { resume } = await req('/resumes', { method: 'POST', token: candidateToken, body: form, isForm: true });
  assert(resume?.id, `resume uploaded (${resume.id})`);
  assert(resume.rawText?.trim().length > 0, `resume text extracted (${resume.rawText.length} chars)`);

  step('5. Candidate applies');
  const { application } = await req('/applications', {
    method: 'POST',
    token: candidateToken,
    body: { jobId: job.id, resumeId: resume.id },
  });
  assert(application.status === 'APPLIED', 'application created with status APPLIED');
  const { applications: companyApps } = await req(`/applications/job/${job.id}`, { token: companyToken });
  assert(companyApps.length === 1, 'company sees the application');

  step('6. Company runs screening (manual "Run screening" button)');
  const screen = await req(`/screening/job/${job.id}/run`, { method: 'POST', token: companyToken });
  assert(screen.screenedCount === 1, 'screening ran for 1 application');
  const ranked = await req(`/screening/job/${job.id}/ranked`, { token: companyToken });
  const result = ranked.ranked[0]?.application?.screeningResult;
  assert(result?.status === 'COMPLETED', `screening COMPLETED (status: ${result?.status})`);
  assert(typeof result.overallScore === 'number', `screening gave a score (${result.overallScore})`);
  const { application: afterScreen } = await req(`/applications/mine/${application.id}`, { token: candidateToken });
  assert(afterScreen.status === 'SCREENING', `screening doesn't auto-decide; status stays SCREENING (${afterScreen.status})`);

  step('7. Company shortlists');
  const bulk = await req(`/applications/job/${job.id}/bulk-status`, {
    method: 'PATCH',
    token: companyToken,
    body: { applicationIds: [application.id], status: 'SHORTLISTED' },
  });
  assert(bulk.updatedCount === 1, 'bulk shortlist updated 1 application');

  step('8. Company creates slots, candidate books one');
  // Starts 5 minutes ago so the slot is joinable right away.
  const rangeStart = new Date(Date.now() - 5 * 60 * 1000);
  const rangeEnd = new Date(rangeStart.getTime() + 30 * 60 * 1000);
  const { slots } = await req(`/scheduling/jobs/${job.id}/slots/generate`, {
    method: 'POST',
    token: companyToken,
    body: { rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString(), durationMinutes: 15, bufferMinutes: 0 },
  });
  assert(slots.length >= 1, `slots generated (${slots.length})`);
  const available = await req(`/scheduling/applications/${application.id}/slots`, { token: candidateToken });
  const availableSlots = available.slots ?? available;
  assert(Array.isArray(availableSlots) && availableSlots.length >= 1, 'candidate sees available slots');
  const { interview: booked } = await req(`/scheduling/applications/${application.id}/book`, {
    method: 'POST',
    token: candidateToken,
    body: { slotId: slots[0].id },
  });
  assert(booked.status === 'SCHEDULED', 'interview booked (SCHEDULED)');
  const { application: afterBook } = await req(`/applications/mine/${application.id}`, { token: candidateToken });
  assert(afterBook.status === 'INTERVIEW_SCHEDULED', `application is INTERVIEW_SCHEDULED (${afterBook.status})`);

  step('9. Candidate starts the AI interview');
  const started = await req(`/interviews/${booked.id}/start`, { method: 'POST', token: candidateToken });
  assert(typeof started.token === 'string' && started.token.length > 20, 'got a LiveKit token');
  assert(started.question?.id, `first question: "${started.question?.text?.slice(0, 60)}…"`);

  step('10. Candidate answers, then ends the interview');
  let current = started.question;
  for (let i = 0; i < 2 && current; i++) {
    const text =
      'I have three years of React experience. I built a dashboard with hooks and Redux, ' +
      'integrated REST APIs, and improved page load time by forty percent.';
    const answered = await req(`/interviews/${booked.id}/answer`, {
      method: 'POST',
      token: candidateToken,
      body: { questionId: current.id, transcript: text, rawTranscript: text, durationSeconds: 15 },
    });
    assert(answered.done || answered.question?.id, `answer ${i + 1} accepted`);
    current = answered.done ? null : answered.question;
  }
  await req(`/interviews/${booked.id}/events`, { method: 'POST', token: candidateToken, body: { type: 'TAB_SWITCH' } });
  const ended = await req(`/interviews/${booked.id}/end`, { method: 'POST', token: candidateToken });
  assert(ended.done === true, 'interview ended');

  step('11. Report is generated');
  const { interview: finished } = await req(`/interviews/${booked.id}`, { token: companyToken });
  assert(finished.status === 'COMPLETED', 'interview is COMPLETED');
  assert(finished.report?.status === 'COMPLETED', `report COMPLETED (status: ${finished.report?.status})`);
  assert(typeof finished.report.overallScore === 'number', `report has an overall score (${finished.report.overallScore})`);
  assert(finished.events.some((e) => e.type === 'TAB_SWITCH'), 'monitoring event was recorded');
  const { application: finalApp } = await req(`/applications/mine/${application.id}`, { token: candidateToken });
  assert(finalApp.status === 'INTERVIEW_COMPLETED', `application is INTERVIEW_COMPLETED (${finalApp.status})`);

  step('12. Company dashboard overview');
  const overview = await req('/companies/dashboard-overview', { token: companyToken });
  assert(overview && typeof overview === 'object', 'dashboard overview responds');

  console.log(`\nSMOKE TEST PASSED ✔  (${passed} checks)`);
}

main().catch((err) => {
  console.error(`\nSMOKE TEST FAILED after ${passed} passing checks:`, err.message);
  process.exit(1);
});
