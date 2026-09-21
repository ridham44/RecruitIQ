import { callOpenRouter } from './openrouter.service.js';
import { sanitizePersonalText } from './sanitize.util.js';
import { generatedQuestionSchema } from '../../shared/schemas/interview-ai.schema.js';

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

Return ONLY a JSON object: { "question": string }. Respond with JSON only, no prose.`;

// stage + job + resume + prior Q&A -> one natural-language interview
// question (Section 5). Called once per planned question; follow-ups use
// interview-answer-evaluator.service.js instead, which generates the
// follow-up text directly as part of evaluating the answer it follows.
export async function generateInterviewQuestion({ stage, job, resumeData, resumeText, previousExchanges }) {
  const userPrompt = JSON.stringify(
    {
      stage,
      guidance: STAGE_GUIDANCE[stage] || 'Ask a relevant interview question for this stage.',
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
