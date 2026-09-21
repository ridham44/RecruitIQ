import { z } from 'zod';

export const registerCompanySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  companyName: z.string().min(1, 'Company name is required'),
  website: z.string().url().optional().or(z.literal('')).optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
});

export const registerCandidateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  location: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});
