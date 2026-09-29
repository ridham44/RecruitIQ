import { z } from 'zod';
import { emailSchema } from './auth.schema.js';

// Build plan P4 — public careers-portal requests (no login).

const phoneInput = z.string().trim().min(6, 'Enter your phone number').max(24);

export const otpSendSchema = z.object({
  phone: phoneInput,
});

export const otpVerifySchema = z.object({
  phone: phoneInput,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const guestApplySchema = z.object({
  slug: z.string().trim().min(1).max(60),
  uploadId: z.string().trim().min(1),
  // Omitted = CV-only submission (§6B): the AI finds the best job.
  jobId: z.string().trim().min(1).optional(),
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  email: emailSchema,
  phone: phoneInput,
  otpToken: z.string().trim().min(1, 'Please verify your phone number'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept how your CV will be used' }) }),
});

export const trackTokenSchema = z.object({
  token: z.string().trim().min(1),
});

export const careersSlugSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Use at least 3 characters')
    .max(50, 'Use at most 50 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes'),
});

export const cvPoolApplySchema = z.object({
  jobId: z.string().trim().min(1),
});
