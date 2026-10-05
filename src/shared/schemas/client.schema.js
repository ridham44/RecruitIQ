import { z } from 'zod';
import {
  orgNameSchema,
  personNameSchema,
  optionalPersonNameSchema,
  requiredText,
  optionalText,
  emailSchema,
  optionalEmailSchema,
  optionalUrlSchema,
  optionalPhoneSchema,
  idSchema,
} from './common.js';

// Build plan P3 — client companies, departments, HR / hiring persons.

export const createClientSchema = z.object({
  name: orgNameSchema('Company name'),
  description: optionalText('Description', 4000),
  website: optionalUrlSchema,
  industry: optionalText('Industry', 120),
  contactName: optionalPersonNameSchema('Contact person'),
  contactEmail: optionalEmailSchema,
  contactPhone: optionalPhoneSchema,
  address: optionalText('Address', 500),
});

export const updateClientSchema = createClientSchema.partial();

export const activeStatusSchema = z.object({
  isActive: z.boolean(),
});

export const departmentSchema = z.object({
  name: requiredText('Department name', 120),
});

export const createHiringPersonSchema = z.object({
  fullName: personNameSchema('Name'),
  email: emailSchema,
  phone: optionalPhoneSchema,
  designation: optionalText('Designation', 120),
  // Optional: HR belongs to the company; a department is just a label.
  departmentId: z.union([z.literal(''), idSchema('department')]).nullable().optional(),
});

export const updateHiringPersonSchema = createHiringPersonSchema.partial();

export const clientRecruitersSchema = z.object({
  memberIds: z
    .array(idSchema())
    .max(500, 'Too many items selected')
    .transform((list) => [...new Set(list)]),
});
