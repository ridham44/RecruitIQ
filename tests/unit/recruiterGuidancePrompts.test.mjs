// Build plan P6 safety test: with no recruiter guidance the question and
// report prompts must be byte-for-byte what they were before P6. The
// "legacy" builders below are verbatim copies of the pre-P6 prompt code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionPrompts } from '../../src/server/ai/interview-question-generator.service.js';
import { buildReportPrompts } from '../../src/server/ai/interview-report-generator.service.js';
import { sanitizePersonalText, sanitizeRecruiterGuidance } from '../../src/server/ai/sanitize.util.js';
import { computeExperienceTier } from '../../src/server/modules/interviews/interviewDifficulty.util.js';

const job = {
  title: 'React Developer',
  requiredSkills: ['React', 'JavaScript'],
  preferredSkills: ['Node.js'],
  description: 'Build React apps.',
  minimumExperience: 2,
};
const resumeData = { name: 'Jane Doe', skills: ['React'], experience: [{ company: 'Acme', role: 'Dev', duration: '2y' }], projects: ['Dashboard'] };
const resumeText = 'Jane Doe\nGender: Female\nReact developer at Acme.';
const exchanges = [{ questionId: 'q1', stage: 'INTRODUCTION', question: 'Tell me about yourself', transcript: 'I build React apps', timedOut: false }];

// ── verbatim pre-P6 question user prompt ──
function legacyQuestionUserPrompt({ stage, job: j, resumeData: rd, resumeText: rt, previousExchanges, difficulty }) {
  const STAGE_GUIDANCE = { JOB_SPECIFIC: 'Ask a question specific to the day-to-day responsibilities and required skills of this job.' };
  const DIFFICULTY_GUIDANCE = { MEDIUM: 'Ask a standard, practically-applied question typical for this role and experience level.' };
  const EXPERIENCE_TIER_GUIDANCE = {
    JUNIOR:
      'The candidate has roughly 1-2 years of experience — expect applied knowledge of fundamentals and some real project exposure, but not deep architectural ownership.',
    MID: 'The candidate has roughly 3-5 years of experience — expect solid applied expertise, some ownership of design decisions, and awareness of trade-offs.',
  };
  const experienceTier = computeExperienceTier(j.minimumExperience);
  const resolvedDifficulty = difficulty || 'MEDIUM';
  return JSON.stringify(
    {
      stage,
      guidance: STAGE_GUIDANCE[stage] || 'Ask a relevant interview question for this stage.',
      difficulty: resolvedDifficulty,
      difficultyGuidance: DIFFICULTY_GUIDANCE[resolvedDifficulty],
      experienceTier,
      experienceTierGuidance: EXPERIENCE_TIER_GUIDANCE[experienceTier],
      job: { title: j.title, requiredSkills: j.requiredSkills, preferredSkills: j.preferredSkills, description: j.description?.slice(0, 3000) },
      candidate: {
        skills: rd?.skills || [],
        experience: rd?.experience || [],
        projects: rd?.projects || [],
        resumeExcerpt: sanitizePersonalText(rt, rd?.name).slice(0, 3000),
      },
      previousExchanges: (previousExchanges || []).slice(-6),
    },
    null,
    2
  );
}

// ── verbatim pre-P6 report user prompt ──
function legacyReportUserPrompt({ job: j, resumeData: rd, resumeText: rt, exchanges: ex }) {
  return JSON.stringify(
    {
      job: { title: j.title, requiredSkills: j.requiredSkills, preferredSkills: j.preferredSkills, description: j.description?.slice(0, 3000) },
      candidateBackground: {
        skills: rd?.skills || [],
        experience: rd?.experience || [],
        resumeExcerpt: sanitizePersonalText(rt, rd?.name).slice(0, 2000),
      },
      transcript: ex.map((e) => ({ questionId: e.questionId, stage: e.stage, question: e.question, answer: e.transcript, timedOut: e.timedOut })),
    },
    null,
    2
  );
}

const qArgs = { stage: 'JOB_SPECIFIC', job, resumeData, resumeText, previousExchanges: exchanges, difficulty: 'MEDIUM' };

test('question prompt is unchanged when there is no recruiter guidance', () => {
  const base = buildQuestionPrompts(qArgs);
  assert.equal(base.userPrompt, legacyQuestionUserPrompt(qArgs));
  for (const empty of [undefined, null, {}, { instructions: '', focusSkills: [] }, { instructions: '   ', focusSkills: [' '] }]) {
    const p = buildQuestionPrompts({ ...qArgs, recruiterGuidance: empty });
    assert.equal(p.userPrompt, base.userPrompt);
    assert.equal(p.systemPrompt, base.systemPrompt);
  }
  assert.ok(!base.systemPrompt.includes('recruiterGuidance'));
});

test('question prompt carries recruiter guidance when set', () => {
  const p = buildQuestionPrompts({ ...qArgs, recruiterGuidance: { instructions: 'Ask about a production incident.', focusSkills: ['Kubernetes'] } });
  const body = JSON.parse(p.userPrompt);
  assert.deepEqual(body.recruiterGuidance, { instructions: 'Ask about a production incident.', focusSkills: ['Kubernetes'] });
  assert.ok(p.systemPrompt.startsWith(buildQuestionPrompts(qArgs).systemPrompt));
  assert.ok(p.systemPrompt.includes('recruiterGuidance'));
});

const rArgs = { job, resumeData, resumeText, exchanges };

test('report prompt is unchanged when there are no evaluation criteria', () => {
  const base = buildReportPrompts(rArgs);
  assert.equal(base.userPrompt, legacyReportUserPrompt(rArgs));
  for (const empty of [undefined, null, '', '   ']) {
    const p = buildReportPrompts({ ...rArgs, evaluationInstructions: empty });
    assert.equal(p.userPrompt, base.userPrompt);
    assert.equal(p.systemPrompt, base.systemPrompt);
  }
  assert.ok(!base.systemPrompt.includes('criteriaAssessment'));
});

test('report prompt asks for criteriaAssessment when criteria are set', () => {
  const p = buildReportPrompts({ ...rArgs, evaluationInstructions: 'System design counts double.' });
  assert.equal(JSON.parse(p.userPrompt).recruiterEvaluationCriteria, 'System design counts double.');
  assert.ok(p.systemPrompt.includes('criteriaAssessment'));
});

test('recruiter guidance drops sentences about protected characteristics', () => {
  const { text, removed } = sanitizeRecruiterGuidance(
    'Check hands-on Kubernetes experience. Prefer male candidates under 30. Ask how they manage deadlines.\nAvoid married applicants'
  );
  assert.equal(removed, 2);
  assert.ok(text.includes('Kubernetes') && text.includes('manage deadlines'));
  assert.ok(!/male|30|married/i.test(text));
  assert.deepEqual(sanitizeRecruiterGuidance(''), { text: '', removed: 0 });
});
