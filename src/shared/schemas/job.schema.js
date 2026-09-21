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
  status: z.nativeEnum(JOB_STATUS).default(JOB_STATUS.OPEN),
});

export const updateJobSchema = createJobSchema.partial();
