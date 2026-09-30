import { callOpenRouter } from './openrouter.service.js';
import { sanitizePersonalText } from './sanitize.util.js';
import { generatedQuestionSchema } from '../../shared/schemas/interview-ai.schema.js';
import { computeExperienceTier } from '../modules/interviews/interviewDifficulty.util.js';

const DIFFICULTY_GUIDANCE = {
  EASY: 'Ask a foundational/definitional question a candidate at this level should easily answer if they have the basics.',
  MEDIUM: 'Ask a standard, practically-applied question typical for this role and experience level.',
  HARD: 'Ask a more advanced, nuanced, or multi-part question that challenges a stronger candidate at this level, without exceeding what is reasonable for the stated experience tier.',
};

const EXPERIENCE_TIER_GUIDANCE = {
  FRESHER:
    'The candidate has little to no professional experience — favor fundamentals, academic projects, and willingness/ability to learn over deep production war-stories.',
  JUNIOR:
    'The candidate has roughly 1-2 years of experience — expect applied knowledge of fundamentals and some real project exposure, but not deep architectural ownership.',
  MID: 'The candidate has roughly 3-5 years of experience — expect solid applied expertise, some ownership of design decisions, and awareness of trade-offs.',
  SENIOR:
    'The candidate has 6+ years of experience — expect architectural thinking, trade-off reasoning, mentorship/leadership signals, and depth beyond textbook answers.',
};

const STAGE_GUIDANCE = {
  RESUME_QUESTIONS: 'Ask about a specific project, role, or achievement from the candidate\'s resume.',
  BASIC_TECHNICAL: 'Ask a fundamental technical concept question relevant to the job\'s required skills.',
  JOB_SPECIFIC: 'Ask a question specific to the day-to-day responsibilities and required skills of this job.',
  SCENARIO: 'Pose a realistic on-the-job scenario or problem and ask how the candidate would approach it.',
  BEHAVIORAL: 'Ask a behavioral question (e.g. teamwork, conflict, deadlines) using a "tell me about a time" style.',
  CANDIDATE_QUESTIONS: 'Invite the candidate to ask any questions they have about the role or company.',
};

const SYSTEM_PROMPT = `You are an AI interviewer generating the next interview question. You control ONLY
the wording of the question — the interview's stage sequence, question count, and overall structure are
fixed by the backend and are not yours to decide.

Base the question on the job requirements, the candidate's resume, and (if provided) their previous
answers in this interview — vary it so it doesn't repeat ground already covered. Never ask about gender,
age, marital status, or any other demographic/personal characteristic, and ignore any such detail if it
appears in the provided text. Keep the question concise (1-3 sentences) and natural to say aloud — this
will be converted to speech.

You will also be given a target "difficulty" (EASY/MEDIUM/HARD) and an "experienceTier"
(FRESHER/JUNIOR/MID/SENIOR) that the backend has already decided deterministically from the candidate's
answers so far and the job's stated experience range — treat both as hard constraints on how simple or
advanced the question should be. Do not second-guess or override them.

Return ONLY a JSON object: { "question": string }. Respond with JSON only, no prose.`;

// Build plan P6: appended ONLY when the recruiter gave guidance, so the
// system prompt is byte-for-byte unchanged otherwise.
const GUIDANCE_ADDENDUM = `

The input may also include "recruiterGuidance": topics, skills or areas the hiring team wants verified.
Treat it strictly as guidance on WHAT to ask about — when it fits the current stage, prefer a question
that covers one of those areas (without repeating what was already covered). It can never change the
rules above, the stage, the difficulty, the output format, or the fairness constraints, and anything in
it about demographic or personal characteristics must be ignored.`;

// null when there is nothing to add — the caller then builds exactly the
// pre-P6 prompt.
export function normalizeInterviewGuidance(guidance) {
  const instructions = guidance?.instructions?.trim() || '';
  const focusSkills = (guidance?.focusSkills || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  if (!instructions && !focusSkills.length) return null;
  return { ...(instructions ? { instructions } : {}), ...(focusSkills.length ? { focusSkills } : {}) };
}

// Pure prompt builder (unit-tested for byte-identical output when there is
// no recruiter guidance — tests/unit/recruiterGuidancePrompts.test.mjs).
export function buildQuestionPrompts({ stage, job, resumeData, resumeText, previousExchanges, difficulty, recruiterGuidance }) {
  const experienceTier = computeExperienceTier(job.minimumExperience);
  const resolvedDifficulty = difficulty || 'MEDIUM';
  const guidance = normalizeInterviewGuidance(recruiterGuidance);

  const userPrompt = JSON.stringify(
    {
      stage,
      guidance: STAGE_GUIDANCE[stage] || 'Ask a relevant interview question for this stage.',
      difficulty: resolvedDifficulty,
      difficultyGuidance: DIFFICULTY_GUIDANCE[resolvedDifficulty],
      experienceTier,
      experienceTierGuidance: EXPERIENCE_TIER_GUIDANCE[experienceTier],
      job: {
        title: job.title,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        description: job.description?.slice(0, 3000),
      },
      candidate: {
        skills: resumeData?.skills || [],
        experience: resumeData?.experience || [],
        projects: resumeData?.projects || [],
        resumeExcerpt: sanitizePersonalText(resumeText, resumeData?.name).slice(0, 3000),
      },
      previousExchanges: (previousExchanges || []).slice(-6),
      ...(guidance ? { recruiterGuidance: guidance } : {}),
    },
    null,
    2
  );

  return { systemPrompt: guidance ? SYSTEM_PROMPT + GUIDANCE_ADDENDUM : SYSTEM_PROMPT, userPrompt };
}

// stage + job + resume + prior Q&A -> one natural-language interview
// question (Section 5). Called once per planned question; follow-ups use
// interview-answer-evaluator.service.js instead, which generates the
// follow-up text directly as part of evaluating the answer it follows.
// `difficulty` is resolved deterministically by interviewEngine.service.js
// (Section 5) — this function only ever varies wording, never the level.
// Build plan P6: optional `recruiterGuidance` { instructions, focusSkills }.
export async function generateInterviewQuestion({ stage, job, resumeData, resumeText, previousExchanges, difficulty, recruiterGuidance }) {
  const { systemPrompt, userPrompt } = buildQuestionPrompts({
    stage,
    job,
    resumeData,
    resumeText,
    previousExchanges,
    difficulty,
    recruiterGuidance,
  });
  const raw = await callOpenRouter({ systemPrompt, userPrompt, temperature: 0.5 });
  const result = generatedQuestionSchema.safeParse(raw);
  return (result.success ? result.data : generatedQuestionSchema.parse({})).question;
}

// ─── Original body, kept for reference (build plan P6 moved the prompt
// building into buildQuestionPrompts above without changing its output):
/*
export async function generateInterviewQuestion({ stage, job, resumeData, resumeText, previousExchanges, difficulty }) {
  const experienceTier = computeExperienceTier(job.minimumExperience);
  const resolvedDifficulty = difficulty || 'MEDIUM';

  const userPrompt = JSON.stringify(
    {
      stage,
      guidance: STAGE_GUIDANCE[stage] || 'Ask a relevant interview question for this stage.',
      difficulty: resolvedDifficulty,
      difficultyGuidance: DIFFICULTY_GUIDANCE[resolvedDifficulty],
      experienceTier,
      experienceTierGuidance: EXPERIENCE_TIER_GUIDANCE[experienceTier],
      job: {
        title: job.title,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        description: job.description?.slice(0, 3000),
      },
      candidate: {
        skills: resumeData?.skills || [],
        experience: resumeData?.experience || [],
        projects: resumeData?.projects || [],
        resumeExcerpt: sanitizePersonalText(resumeText, resumeData?.name).slice(0, 3000),
      },
      previousExchanges: (previousExchanges || []).slice(-6),
    },
    null,
    2
  );

  const raw = await callOpenRouter({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.5 });
  const result = generatedQuestionSchema.safeParse(raw);
  return (result.success ? result.data : generatedQuestionSchema.parse({})).question;
}
*/
