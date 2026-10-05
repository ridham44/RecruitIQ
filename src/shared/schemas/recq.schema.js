import { z } from 'zod';
import { idSchema } from './common.js';

// Build plan P9 — /recq agency-link candidate requests (no login). The
// candidate's email is NEVER taken from the request body: it comes from the
// uploaded resume on the server (§5), so no email field appears here.

const jobSlug = z.string().trim().toLowerCase().min(1).max(80);

export const recqOtpSendSchema = z.object({
  uploadId: idSchema('uploadId'),
  jobSlug: jobSlug.optional(),
});

export const recqOtpVerifySchema = z.object({
  uploadId: idSchema('uploadId'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const recqApplySchema = z.object({
  uploadId: idSchema('uploadId'),
  jobSlugs: z.array(jobSlug).min(1, 'Choose at least one job').max(20, 'Too many jobs selected'),
  recqToken: z.string().trim().min(1, 'Please verify your email first').max(1024),
});
