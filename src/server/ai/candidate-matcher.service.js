import { callOpenRouter } from './openrouter.service.js';
import { screeningAnalysisSchema } from '../../shared/schemas/screening.schema.js';

const SYSTEM_PROMPT = `You are a candidate-screening engine performing semantic/contextual matching
between a job's requirements and a candidate's resume. You are NOT the only source of truth —
deterministic rule-based checks are applied separately — so focus on nuance a keyword match would
miss (related/transferable skills, seniority implied by role titles, relevance of projects, etc.).

You must evaluate the candidate ONLY on job-relevant qualifications: skills, experience, education,
projects, and certifications. Gender, name, age, photo, or any other demographic or personal
characteristic must NEVER factor into your scoring, reasoning, strengths, or concerns — even if such
information happens to appear in the provided text. If you notice any such detail, ignore it entirely.

Return ONLY a JSON object with this exact shape:

{
  "skillMatchScore": number (0-100),
  "experienceMatchScore": number (0-100),
  "educationMatchScore": number (0-100),
  "matchedSkills": string[],
  "missingSkills": string[],
  "strengths": string[],
  "concerns": string[],
  "reasoning": string
}

Respond with JSON only, no prose.`;

// Strips demographic/PII lines (gender, DOB, age, marital status, etc.) and
// the candidate's own name out of raw resume text before it ever reaches
// the LLM prompt. This is a deliberate second layer of defense alongside
// the system prompt above: bias-relevant fields must never even be visible
// to the model, not just "ignored" by instruction.
const DEMOGRAPHIC_LINE_PATTERN =
  /^.*\b(gender|sex|date of birth|dob|age|marital status|religion|nationality|caste)\b\s*[:\-].*$/gim;

function sanitizeResumeExcerpt(resumeText, candidateName) {
  if (!resumeText) return '';
  let sanitized = resumeText.replace(DEMOGRAPHIC_LINE_PATTERN, '');

  if (candidateName?.trim()) {
    const escapedName = candidateName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escapedName, 'gi'), '[Candidate]');
  }

  return sanitized;
}

// Job requirements + candidate resume -> AI semantic match scores
// (Section 13). This is combined with deterministic checks in
// screening.service.js to produce the final overallScore — the LLM alone
// never decides the outcome.
//
// Only job-relevant fields are ever placed into the prompt payload below —
// `resumeData` may carry a `gender`/`university`/`college` etc. (profile
// auto-fill fields), but they are deliberately never spread into `candidate`
// here. Keep that discipline when adding new fields to resumeData.
export async function matchCandidateToJob({ job, resumeData, resumeText }) {
  const userPrompt = JSON.stringify(
    {
      job: {
        title: job.title,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        minimumExperience: job.minimumExperience,
        maximumExperience: job.maximumExperience,
        educationRequirements: job.educationRequirements,
        description: job.description?.slice(0, 4000),
      },
      candidate: {
        skills: resumeData?.skills || [],
        experience: resumeData?.experience || [],
        education: resumeData?.education || [],
        totalExperienceYears: resumeData?.totalExperienceYears || 0,
        projects: resumeData?.projects || [],
        certifications: resumeData?.certifications || [],
        resumeExcerpt: sanitizeResumeExcerpt(resumeText, resumeData?.name).slice(0, 4000),
      },
    },
    null,
    2
  );

  const raw = await callOpenRouter({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.1 });

  const result = screeningAnalysisSchema.safeParse(raw);
  return result.success ? result.data : screeningAnalysisSchema.parse({});
}
