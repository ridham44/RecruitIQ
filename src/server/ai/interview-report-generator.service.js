import { callOpenRouter } from './openrouter.service.js';
import { sanitizePersonalText } from './sanitize.util.js';
import { interviewReportSchema } from '../../shared/schemas/interview-ai.schema.js';
import { computeSkillOverlap } from '../modules/screening/deterministic.util.js';

const SYSTEM_PROMPT = `You are evaluating a completed AI-conducted interview transcript. This is the deep,
final evaluation (a lightweight in-the-moment check already happened live during the interview) — take
your time and be specific, citing the transcript.

Evaluate ONLY job-relevant qualifications: technical knowledge, communication clarity, problem-solving,
and relevant experience demonstrated in the answers. Gender, name, age, or any other demographic/personal
characteristic must NEVER factor into scoring or reasoning — ignore any such detail if it appears in the
transcript.

Do NOT penalize the candidate for grammar, accent, filler words, or minor speech-to-text transcription
errors (e.g. a mis-transcribed technical term) — judge the substance of what they were clearly trying to
say, not the surface text. Do NOT infer personality traits, honesty, confidence, or intelligence from tone
or phrasing — score only the content of the answer.

For each question, score four separate dimensions (0-100 each):
- correctness: was the technical/factual content of the answer accurate?
- relevance: did the answer actually address what was asked?
- technicalDepth: did the answer show real depth/understanding vs. a surface-level or memorized response?
- communication: was the answer clearly structured and easy to follow (independent of grammar/accent/
  filler words — judge clarity of thought, not delivery)?
Then give one overall "score" (0-100) synthesizing those four for that question, plus up to 3 "strengths"
and up to 3 "missingConcepts" (concepts the question was probing for that the answer didn't cover), and a
short "evaluationReason".

Return ONLY a JSON object with this exact shape:
{
  "overallScore": number (0-100),
  "technicalScore": number (0-100),
  "communicationScore": number (0-100),
  "strengths": string[],
  "areasForImprovement": string[],
  "questionAnalysis": [{
    "questionId": string, "question": string, "answerSummary": string,
    "correctness": number (0-100), "relevance": number (0-100),
    "technicalDepth": number (0-100), "communication": number (0-100),
    "score": number (0-100), "strengths": string[], "missingConcepts": string[],
    "evaluationReason": string
  }],
  "reasoning": string (2-4 sentences, overall summary)
}
Respond with JSON only, no prose.`;

// Build plan P6: appended ONLY when the recruiter set evaluation criteria,
// so the system prompt is byte-for-byte unchanged otherwise.
const CRITERIA_ADDENDUM = `

The input also includes "recruiterEvaluationCriteria" written by the hiring team (e.g. which skills
matter most, minimum bars, relative weights). Apply them when forming your scores and reasoning, as long
as they are job-relevant — ignore anything about demographic or personal characteristics, and never let
them override the fairness rules above. Additionally return, in the same JSON object, this REQUIRED
top-level key (never omit it, even if the evidence is thin — then use "PARTLY" or "NOT_MET"):
  "criteriaAssessment": [{ "criterion": string, "verdict": "MET" | "PARTLY" | "NOT_MET", "evidence": string }]
with one entry per distinct criterion, where "evidence" briefly cites the transcript.`;

// Build plan P6: LLMs sometimes rename the key or return an object map —
// normalize the common shapes before validation.
function normalizeCriteria(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const list = raw.criteriaAssessment ?? raw.criteria_assessment ?? raw.criteria ?? raw.recruiterCriteria;
  if (list && !Array.isArray(list) && typeof list === 'object') {
    raw.criteriaAssessment = Object.entries(list).map(([criterion, v]) =>
      typeof v === 'object' ? { criterion, ...v } : { criterion, verdict: String(v) }
    );
  } else if (Array.isArray(list)) {
    raw.criteriaAssessment = list.map((c) =>
      c && typeof c === 'object'
        ? {
            criterion: c.criterion ?? c.name ?? c.title ?? '',
            verdict: String(c.verdict ?? c.status ?? c.result ?? 'PARTLY')
              .toUpperCase()
              .replace(/^PARTIAL(LY)?(_MET)?$/, 'PARTLY')
              .replace(/\s+/g, '_')
              .replace(/^PARTIALLY_MET$/, 'PARTLY')
              .replace(/^NOT$/, 'NOT_MET'),
            evidence: c.evidence ?? c.reason ?? c.explanation ?? '',
          }
        : c
    );
  }
  return raw;
}

// Pure prompt builder (unit-tested for byte-identical output when there are
// no recruiter criteria — tests/unit/recruiterGuidancePrompts.test.mjs).
export function buildReportPrompts({ job, resumeData, resumeText, exchanges, evaluationInstructions }) {
  const criteria = evaluationInstructions?.trim() || '';
  const userPrompt = JSON.stringify(
    {
      job: {
        title: job.title,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        description: job.description?.slice(0, 3000),
      },
      candidateBackground: {
        skills: resumeData?.skills || [],
        experience: resumeData?.experience || [],
        resumeExcerpt: sanitizePersonalText(resumeText, resumeData?.name).slice(0, 2000),
      },
      transcript: exchanges.map((e) => ({
        questionId: e.questionId,
        stage: e.stage,
        question: e.question,
        answer: e.transcript,
        timedOut: e.timedOut,
      })),
      ...(criteria ? { recruiterEvaluationCriteria: criteria } : {}),
    },
    null,
    2
  );
  return { systemPrompt: criteria ? SYSTEM_PROMPT + CRITERIA_ADDENDUM : SYSTEM_PROMPT, userPrompt };
}

// Build plan P6: optional `evaluationInstructions` → also returns criteriaAssessment.
export async function generateInterviewReport({ job, resumeData, resumeText, exchanges, evaluationInstructions }) {
  const { systemPrompt, userPrompt } = buildReportPrompts({ job, resumeData, resumeText, exchanges, evaluationInstructions });
  const raw = await callOpenRouter({ systemPrompt, userPrompt, temperature: 0.2 });
  // const result = interviewReportSchema.safeParse(raw);
  const result = interviewReportSchema.safeParse(evaluationInstructions?.trim() ? normalizeCriteria(raw) : raw);
  const report = result.success ? result.data : interviewReportSchema.parse({});
  // Only meaningful when criteria were given; never trust an unasked-for list.
  if (!evaluationInstructions?.trim()) delete report.criteriaAssessment;
  return report;
}

// Full Q&A transcript + job + resume -> deep final evaluation (Section 8).
// Deterministic skill-overlap (reused from the screening module, not
// reimplemented) is computed separately and merged in by
// interviewEngine.service.js's finalizeReport — this function only ever
// returns the LLM's qualitative read, never the sole source of truth for
// resume/job alignment facts.
// ─── Original body, kept for reference (build plan P6 moved the prompt
// building into buildReportPrompts above without changing its output):
/*
export async function generateInterviewReport({ job, resumeData, resumeText, exchanges }) {
  const userPrompt = JSON.stringify(
    {
      job: {
        title: job.title,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        description: job.description?.slice(0, 3000),
      },
      candidateBackground: {
        skills: resumeData?.skills || [],
        experience: resumeData?.experience || [],
        resumeExcerpt: sanitizePersonalText(resumeText, resumeData?.name).slice(0, 2000),
      },
      transcript: exchanges.map((e) => ({
        questionId: e.questionId,
        stage: e.stage,
        question: e.question,
        answer: e.transcript,
        timedOut: e.timedOut,
      })),
    },
    null,
    2
  );

  const raw = await callOpenRouter({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.2 });
  const result = interviewReportSchema.safeParse(raw);
  return result.success ? result.data : interviewReportSchema.parse({});
}
*/

// Deterministic component of "resume/job requirement alignment" (Section 8)
// — kept separate from the LLM's read, same discipline as screening.
export function computeResumeAlignment(resumeData, job) {
  const required = computeSkillOverlap(resumeData?.skills, job.requiredSkills);
  const preferred = computeSkillOverlap(resumeData?.skills, job.preferredSkills);
  return {
    requiredSkillsMatched: required.matched,
    requiredSkillsMissing: required.missing,
    requiredSkillMatchScore: required.score,
    preferredSkillsMatched: preferred.matched,
    preferredSkillMatchScore: preferred.score,
  };
}
