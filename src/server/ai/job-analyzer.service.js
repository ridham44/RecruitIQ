import { callOpenRouter } from './openrouter.service.js';
import { jobAnalysisSchema } from '../../shared/schemas/job-analysis.schema.js';

const SYSTEM_PROMPT = `You are a job description analysis engine. Extract structured hiring
requirements from a job description and return ONLY a JSON object with this exact shape:

{
  "requiredSkills": string[],
  "preferredSkills": string[],
  "minimumExperience": number,
  "maximumExperience": number | null,
  "education": string[],
  "summary": string
}

Rules:
- "minimumExperience"/"maximumExperience" are in years.
- If the description conflicts with fields the company already entered explicitly, prefer what's
  written in the description text.
- Respond with JSON only, no prose.`;

// Job title/description -> structured requirements (Section 12). Both the
// original text and this structured output are stored on the Job record so
// screening has a consistent, queryable shape to work against.
export async function analyzeJobDescription({ title, description }) {
  const raw = await callOpenRouter({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Job Title: ${title}\n\nJob Description:\n${description.slice(0, 8000)}`,
  });

  const result = jobAnalysisSchema.safeParse(raw);
  return result.success ? result.data : jobAnalysisSchema.parse({});
}
