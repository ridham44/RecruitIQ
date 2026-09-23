import { z } from 'zod';
import { EMPLOYMENT_TYPE, JOB_STATUS } from '../constants/statuses.js';

export const createJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  minimumExperience: z.coerce.number().min(0).default(0),
  maximumExperience: z.coerce.number().min(0).optional().nullable(),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  educationRequirements: z.array(z.string()).default([]),
  location: z.string().optional(),
  employmentType: z.nativeEnum(EMPLOYMENT_TYPE).default(EMPLOYMENT_TYPE.FULL_TIME),
  workMode: z.enum(['On-site', 'Remote', 'Hybrid']).default('On-site'),
  openings: z.coerce.number().int().min(1, 'Number of openings must be at least 1').default(1),
  numberOfOpenings: z.coerce.number().int().min(1).optional(),
  jobLevel: z.enum(['Junior', 'Mid', 'Senior', 'Lead']).default('Mid'),
  noticePeriod: z.string().optional().nullable(),
  languagesRequired: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  salaryRange: z.string().optional().nullable(),
  status: z.nativeEnum(JOB_STATUS).default(JOB_STATUS.OPEN),
  // Screening decision settings — see the comment on Job.minAcceptableScore
  // in schema.prisma. autoRejectBelowMinScore only ever auto-rejects; it
  // never auto-shortlists.
  minAcceptableScore: z.coerce.number().min(0).max(100).default(75),
  autoRejectBelowMinScore: z.boolean().default(false),
});

export const updateJobSchema = createJobSchema.partial();
