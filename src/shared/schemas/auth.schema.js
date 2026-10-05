import { z } from 'zod';
import { emailSchema, orgNameSchema, personNameSchema, optionalText, optionalUrlSchema, optionalPhoneSchema } from './common.js';

export { emailSchema };

// bcrypt only uses the first 72 bytes — anything longer would be silently ignored.
export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .refine((v) => v.trim() === v, 'Password cannot start or end with a space');

export const registerCompanySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  companyName: orgNameSchema('Agency name'),
  website: optionalUrlSchema,
  industry: optionalText('Industry', 120),
  location: optionalText('Location', 200),
});

export const registerCandidateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: personNameSchema('Full name'),
  phone: optionalPhoneSchema,
  location: optionalText('Location', 200),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(200, 'Password is too long'),
});

// Forgot password: request a reset link by email.
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Build plan P1: set a password from an emailed invite link.
export const setPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Token is required').max(256, 'Invalid token'),
  password: passwordSchema,
});
