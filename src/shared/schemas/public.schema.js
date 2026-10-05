import { z } from 'zod';
import { emailSchema, personNameSchema, idSchema, phoneProblem } from './common.js';

// Build plan P4 — public careers-portal requests (no login).

// Same shape rules as every other phone field; the server then normalizes it
// to E.164 for the OTP (src/server/utils/phone.js).
const phoneInput = z
  .string({ required_error: 'Enter your phone number' })
  .trim()
  .min(1, 'Enter your phone number')
  .max(24, 'Phone number is too long')
  .superRefine((v, ctx) => {
    const problem = phoneProblem(v);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });
const tokenSchema = z.string().trim().min(1).max(512);

export const otpSendSchema = z.object({
  phone: phoneInput,
});

export const otpVerifySchema = z.object({
  phone: phoneInput,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const guestApplySchema = z.object({
  slug: z.string().trim().min(1).max(60),
  uploadId: idSchema('uploadId'),
  // Omitted = CV-only submission (§6B): the AI finds the best job.
  jobId: idSchema('jobId').optional(),
  fullName: personNameSchema('Full name'),
  email: emailSchema,
  phone: phoneInput,
  otpToken: z.string().trim().min(1, 'Please verify your phone number').max(512),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept how your CV will be used' }) }),
});

export const trackTokenSchema = z.object({
  token: tokenSchema,
});

// Book a slot from the status link (no login).
export const trackBookingSchema = z.object({
  token: tokenSchema,
  slotId: idSchema('slotId'),
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
  jobId: idSchema('jobId'),
});
