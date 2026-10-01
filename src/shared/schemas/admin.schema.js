import { z } from 'zod';
import { emailSchema } from './auth.schema.js';

// Build plan P1 — Platform Admin requests.

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal('')).optional();

const companyFields = {
  companyName: z.string().trim().min(1, 'Agency name is required').max(200),
  website: z.string().trim().url('Website must be a valid URL (https://…)').optional().or(z.literal('')).optional(),
  industry: optionalText(120),
  size: optionalText(60),
  location: optionalText(200),
  description: optionalText(4000),
};

export const adminCreateCompanySchema = z.object({
  ...companyFields,
  ownerEmail: emailSchema,
});

export const adminUpdateCompanySchema = z
  .object(companyFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const adminCompanyStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export const adminUserStatusSchema = z.object({
  isActive: z.boolean(),
});
