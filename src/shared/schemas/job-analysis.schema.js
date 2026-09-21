import { z } from 'zod';

// Shape the AI is instructed to return when extracting structured
// requirements from a job description (Section 12).
export const jobAnalysisSchema = z.object({
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  minimumExperience: z.coerce.number().min(0).default(0),
  maximumExperience: z.coerce.number().min(0).nullable().default(null),
  education: z.array(z.string()).default([]),
  summary: z.string().default(''),
});
