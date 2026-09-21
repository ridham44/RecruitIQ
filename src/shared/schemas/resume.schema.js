import { z } from 'zod';

// Shape the AI is instructed to return when parsing a resume (Section 11).
// Used to validate LLM output before it is persisted — malformed/missing
// fields fall back to safe defaults rather than being trusted blindly.
export const resumeAnalysisSchema = z.object({
  name: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  skills: z.array(z.string()).default([]),
  experience: z
    .array(
      z.object({
        company: z.string().default(''),
        role: z.string().default(''),
        duration: z.string().default(''),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string().default(''),
        field: z.string().default(''),
      })
    )
    .default([]),
  projects: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  totalExperienceYears: z.coerce.number().min(0).default(0),
});
