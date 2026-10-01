import { z } from 'zod';

// Build plan P3 — client companies, departments, HR / hiring persons.

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal('')).optional();
const optionalEmail = z.string().trim().email('Enter a valid email').optional().or(z.literal('')).optional();
const optionalUrl = z.string().trim().url('Website must be a valid URL (https://…)').optional().or(z.literal('')).optional();

export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(200),
  description: optionalText(4000),
  website: optionalUrl,
  industry: optionalText(120),
  contactName: optionalText(120),
  contactEmail: optionalEmail,
  contactPhone: optionalText(40),
  address: optionalText(500),
});

export const updateClientSchema = createClientSchema.partial();

export const activeStatusSchema = z.object({
  isActive: z.boolean(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required').max(120),
});

export const createHiringPersonSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  phone: optionalText(40),
  designation: optionalText(120),
  // Optional: HR belongs to the company; a department is just a label.
  departmentId: z.string().trim().max(64).nullable().optional().or(z.literal('')),
});

export const updateHiringPersonSchema = createHiringPersonSchema.partial();

export const clientRecruitersSchema = z.object({
  memberIds: z.array(z.string().trim().min(1)).max(500),
});
