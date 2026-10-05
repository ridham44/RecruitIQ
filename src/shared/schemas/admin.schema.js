import { z } from 'zod';
import { emailSchema, orgNameSchema, optionalText, optionalUrlSchema } from './common.js';

// Build plan P1 — Platform Admin requests.

const companyFields = {
  companyName: orgNameSchema('Agency name'),
  website: optionalUrlSchema,
  industry: optionalText('Industry', 120),
  size: optionalText('Company size', 60),
  location: optionalText('Location', 200),
  description: optionalText('Description', 4000),
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
