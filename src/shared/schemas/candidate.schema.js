import { z } from 'zod';
import { personNameSchema, optionalPhoneSchema, optionalText, tagListSchema } from './common.js';

export const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];

// Candidate profile update — academic information is now managed via the
// separate Education model (see education.schema.js and /candidates/me/education).
export const updateCandidateSchema = z.object({
  fullName: personNameSchema('Full name').optional(),
  phone: optionalPhoneSchema,
  location: optionalText('Location', 200),
  headline: optionalText('Headline', 200),
  skills: tagListSchema('Skills', { maxItems: 50, maxLength: 60 }).optional(),
  gender: z.enum(GENDER_OPTIONS, { errorMap: () => ({ message: 'Choose a valid option' }) }).optional().nullable(),
});
