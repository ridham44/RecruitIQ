import { callOpenRouter } from './openrouter.service.js';
import { screeningAnalysisSchema } from '../../shared/schemas/screening.schema.js';

const SYSTEM_PROMPT = `You are a candidate-screening engine performing semantic/contextual matching
between a job's requirements and a candidate's resume. You are NOT the only source of truth —
deterministic rule-based checks are applied separately — so focus on nuance a keyword match would
miss (related/transferable skills, seniority implied by role titles, relevance of projects, etc.).

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

// Job requirements + candidate resume -> AI semantic match scores
// (Section 13). This is combined with deterministic checks in
// screening.service.js to produce the final overallScore — the LLM alone
// never decides the outcome.
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
        resumeExcerpt: (resumeText || '').slice(0, 4000),
      },
    },
    null,
    2
  );

  const raw = await callOpenRouter({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.1 });

  const result = screeningAnalysisSchema.safeParse(raw);
  return result.success ? result.data : screeningAnalysisSchema.parse({});
}
