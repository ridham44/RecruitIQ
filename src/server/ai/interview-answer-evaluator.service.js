import { callOpenRouter } from './openrouter.service.js';
import { answerEvaluationSchema } from '../../shared/schemas/interview-ai.schema.js';

const SYSTEM_PROMPT = `You are an AI interviewer deciding, in the moment, whether a candidate's answer
warrants a quick follow-up question before moving on. This is a lightweight, real-time check — a deeper
evaluation happens after the interview ends, so keep this fast and focused.

Ask a follow-up only when it would genuinely add signal: the answer was vague, surprising, or you'd
expect a strong candidate to have more to say. Do not ask a follow-up just to fill time, and never ask
about gender, age, or any other demographic/personal characteristic.

Return ONLY a JSON object with this exact shape:
{
  "needsFollowUp": boolean,
  "followUpQuestion": string (empty string if needsFollowUp is false),
  "relevance": number (0-100, how directly the answer addressed the question),
  "note": string (one short internal note, not shown to the candidate)
}
Respond with JSON only, no prose.`;

// question + candidate's transcribed answer -> follow-up decision
// (Section 5/8). This is the "lightweight evaluation" used only to steer
// the live interview; interview-report-generator.service.js does the real
// scoring afterward. `allowFollowUp` is a deterministic budget check the
// caller (interviewEngine.service.js) applies — the LLM is never trusted to
// self-limit follow-ups.
export async function evaluateAnswer({ question, transcript, job, allowFollowUp }) {
  if (!transcript?.trim()) {
    return { needsFollowUp: false, followUpQuestion: '', relevance: 0, note: 'No answer given (timed out or empty).' };
  }

  const userPrompt = JSON.stringify(
    {
      jobTitle: job.title,
      question,
      candidateAnswer: transcript.slice(0, 3000),
      followUpAllowed: allowFollowUp,
    },
    null,
    2
  );

  const raw = await callOpenRouter({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.2 });
  const result = answerEvaluationSchema.safeParse(raw);
  const evaluation = result.success ? result.data : answerEvaluationSchema.parse({});

  return { ...evaluation, needsFollowUp: allowFollowUp && evaluation.needsFollowUp && Boolean(evaluation.followUpQuestion) };
}
