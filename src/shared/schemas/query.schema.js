import { z } from 'zod';
import { ROLES } from '../constants/roles.js';
import { idSchema } from './common.js';

// Query-string filters. A repeated param (?q=a&q=b) arrives as an array and
// fails here with a 400 instead of crashing a service.
const search = z.string().trim().max(100, 'Search is too long').optional();

export const adminCompaniesQuerySchema = z.object({
  q: search,
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

export const adminUsersQuerySchema = z.object({
  q: search,
  role: z.enum(Object.values(ROLES)).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const clientsQuerySchema = z.object({
  q: search,
  status: z.enum(['active', 'inactive']).optional(),
});

export const cvPoolQuerySchema = z.object({
  status: z.enum(['PENDING', 'MATCHING', 'MATCHED', 'NO_MATCH', 'FAILED']).optional(),
});

export const rankedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(500, 'Limit can be at most 500').optional(),
});

export const clientPortalQuerySchema = z.object({
  jobId: idSchema('jobId').optional(),
});

export const downloadQuerySchema = z.object({
  download: z.string().max(5).optional(),
});
