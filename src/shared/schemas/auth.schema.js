import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerCompanySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().trim().min(1, 'Company name is required'),
  website: z.string().trim().url().optional().or(z.literal('')).optional(),
  industry: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

export const registerCandidateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1, 'Full name is required'),
  phone: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

