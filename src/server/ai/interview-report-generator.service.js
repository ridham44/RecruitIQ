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

Return ONLY a JSON object with this exact shape:
{
  "overallScore": number (0-100),
  "technicalScore": number (0-100),
  "communicationScore": number (0-100),
  "strengths": string[],
  "areasForImprovement": string[],
  "questionAnalysis": [{ "questionId": string, "question": string, "answerSummary": string, "score": number (0-100), "notes": string }],
  "reasoning": string (2-4 sentences, overall summary)
}
Respond with JSON only, no prose.`;

// Full Q&A transcript + job + resume -> deep final evaluation (Section 8).
// Deterministic skill-overlap (reused from the screening module, not
// reimplemented) is computed separately and merged in by
// interviewEngine.service.js's finalizeReport — this function only ever
// returns the LLM's qualitative read, never the sole source of truth for
// resume/job alignment facts.
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
