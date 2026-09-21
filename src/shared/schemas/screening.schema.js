import { z } from 'zod';

// Shape the AI is instructed to return for candidate-matching (Section 13).
// This covers the *semantic* portion of the score; deterministic checks are
// computed separately in screening.service.js and merged in.
export const screeningAnalysisSchema = z.object({
  skillMatchScore: z.coerce.number().min(0).max(100).default(0),
  experienceMatchScore: z.coerce.number().min(0).max(100).default(0),
  educationMatchScore: z.coerce.number().min(0).max(100).default(0),
  matchedSkills: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  reasoning: z.string().default(''),
});
