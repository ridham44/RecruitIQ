import { callOpenRouter } from './openrouter.service.js';
import { resumeAnalysisSchema } from '../../shared/schemas/resume.schema.js';

const SYSTEM_PROMPT = `You are a resume parsing engine. Extract structured information from raw resume
text and return ONLY a JSON object with this exact shape:

{
  "name": string,
  "email": string,
  "phone": string,
  "skills": string[],
  "experience": [{ "company": string, "role": string, "duration": string }],
  "education": [{ "degree": string, "field": string }],
  "projects": string[],
  "certifications": string[],
  "totalExperienceYears": number,
  "university": string,
  "college": string,
  "degree": string,
  "spi": number | null,
  "gender": string
}

Rules:
- If a field cannot be found, use an empty string, empty array, 0, or null as appropriate.
- "totalExperienceYears" is your best-effort estimate of total professional experience in years.
- "university"/"college"/"degree" are the candidate's most recent/highest academic institution and
  exact degree name (e.g. "BCA", "B.Tech in Computer Science and Technology", "MBA") — do not
  normalize to a generic value.
- "spi" is the candidate's latest or final SPI/CGPA on a 0-10 scale if explicitly stated; otherwise null.
- "gender" must be an EMPTY STRING unless the resume explicitly states it (e.g. a "Gender:" field).
  NEVER infer gender from the candidate's name, pronouns, photo, or any other indirect signal — only
  extract it if it is written verbatim in the document. This field is for profile display only.
- Do not invent information that is not present in the text.
- Respond with JSON only, no prose.`;

// Raw resume text -> AI extraction -> validated structured data (Section 11).
// The AI's output is never trusted blindly: it is parsed through
// resumeAnalysisSchema, which fills in safe defaults for missing/malformed
// fields before anything is persisted.
export async function analyzeResume(resumeText) {
  const raw = await callOpenRouter({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: resumeText.slice(0, 15000),
  });

  const result = resumeAnalysisSchema.safeParse(raw);
  if (result.success) return result.data;

  // Malformed LLM output — fall back to schema defaults rather than
  // throwing, so a screening flow can still proceed with an empty profile.
  return resumeAnalysisSchema.parse({});
}
