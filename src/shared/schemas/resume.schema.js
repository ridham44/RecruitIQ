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

  // Academic profile fields (Section 6), used ONLY to suggest values for
  // currently-empty Candidate profile fields (resumes.service.js). Never
  // read by AI screening/matching — see candidate-matcher.service.js.
  university: z.string().default(''),
  college: z.string().default(''),
  degree: z.string().default(''),
  spi: z.coerce.number().min(0).max(10).nullable().default(null),
  // Extracted ONLY if explicitly stated in the resume text, and ONLY ever
  // used to prefill the profile's optional gender field — never sent to the
  // AI matcher/screening prompt.
  gender: z.string().default(''),
});
