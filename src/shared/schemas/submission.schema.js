import { z } from 'zod';
import { emailSchema, idSchema, optionalPersonNameSchema, optionalText } from './common.js';

// Build plan P7 — "Submit to company": send the candidate package to a
// Company HR (hiringPersonId) or to a typed email. Neither = the job's HR.
// Shared by the submissions route and SubmitToClientCard.
export const submitCandidateSchema = z
  .object({
    applicationId: idSchema('application'),
    hiringPersonId: idSchema('Company HR').optional(),
    recipientEmail: emailSchema.optional(),
    recipientName: optionalPersonNameSchema('Name'),
    note: optionalText('Note', 1000),
  })
  .refine((d) => !(d.hiringPersonId && d.recipientEmail), {
    message: 'Choose a Company HR or enter an email, not both',
    path: ['recipientEmail'],
  });
