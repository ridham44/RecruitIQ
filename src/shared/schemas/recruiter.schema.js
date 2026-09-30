import { z } from 'zod';
import { emailSchema } from './auth.schema.js';
import { ASSIGNABLE_PERMISSIONS } from '../constants/permissions.js';

// Build plan P2 — recruiter management requests.

const permissionsSchema = z.array(z.enum(ASSIGNABLE_PERMISSIONS)).max(ASSIGNABLE_PERMISSIONS.length);
const idListSchema = z.array(z.string().trim().min(1)).max(500);

export const inviteRecruiterSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  permissions: permissionsSchema.default([]),
  jobIds: idListSchema.default([]),
});

export const updateRecruiterSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(120),
});

export const recruiterStatusSchema = z.object({
  isActive: z.boolean(),
});

export const recruiterPermissionsSchema = z.object({
  permissions: permissionsSchema,
});

export const recruiterJobsSchema = z.object({
  jobIds: idListSchema,
});

export const jobRecruitersSchema = z.object({
  memberIds: idListSchema,
});
