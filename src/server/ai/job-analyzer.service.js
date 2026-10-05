import { callOpenRouter } from './openrouter.service.js';
import { jobAnalysisSchema } from '../../shared/schemas/job-analysis.schema.js';

const SYSTEM_PROMPT = `You are a job description analysis engine. Extract the hiring details that the
job description states and return ONLY a JSON object with this exact shape:

{
  "requiredSkills": string[],
  "preferredSkills": string[],
  "minimumExperience": number | null,
  "maximumExperience": number | null,
  "education": string[],
  "summary": string,
  "location": string | null,
  "workMode": "On-site" | "Remote" | "Hybrid" | null,
  "employmentType": "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "FREELANCE" | null,
  "jobLevel": "Junior" | "Mid" | "Senior" | "Lead" | null,
  "openings": number | null,
  "noticePeriod": string | null,
  "salaryRange": string | null,
  "languagesRequired": string[],
  "certifications": string[]
}

Rules:
- Only extract what the text actually says. If something isn't stated, use null (or [] for lists).
  Never guess or invent a value.
- "minimumExperience"/"maximumExperience" are in years ("3-5 years" → 3 and 5; "5+ years" → 5 and null).
- "requiredSkills" are must-haves; "preferredSkills" are nice-to-haves. Use short skill names
  ("React", "Node.js", "PostgreSQL"), not sentences.
- "education": degrees or fields of study asked for, e.g. "B.Tech Computer Science", "MBA".
- "location": city / region / country as written, e.g. "Maranello, Italy". Not the work mode.
- "jobLevel": only when the seniority is stated or the title says it (Junior, Senior, Lead…);
  "Mid" only when the text says mid-level.
- "noticePeriod": as written, e.g. "Immediate", "30 days", "60 days".
- "salaryRange": as written, including currency, e.g. "₹6–10 LPA", "€55k–75k".
- "languagesRequired": spoken languages only (English, Italian…), not programming languages.
- "certifications": named certifications only (AWS Certified Developer, PMP…).
- "summary": one or two plain sentences describing the role.
- Respond with JSON only, no prose.`;

// Job title/description -> structured requirements and job details (Section
// 12). Fields the AI gets wrong or leaves out come back as null / [] — see
// jobAnalysisSchema — so one bad field never discards the rest.
export async function analyzeJobDescription({ title, description }) {
  const raw = await callOpenRouter({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Job Title: ${title}\n\nJob Description:\n${description.slice(0, 8000)}`,
  });

  const result = jobAnalysisSchema.safeParse(raw && typeof raw === 'object' ? raw : {});
  return result.success ? result.data : jobAnalysisSchema.parse({});
}
