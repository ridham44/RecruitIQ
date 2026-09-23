import { z } from 'zod';

export const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];

// Candidate profile update — academic information is now managed via the
// separate Education model (see education.schema.js and /candidates/me/education).
export const updateCandidateSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  skills: z.array(z.string()).optional(),
  gender: z.enum(GENDER_OPTIONS).optional().nullable(),
});
