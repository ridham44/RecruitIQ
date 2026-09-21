import { z } from 'zod';

export const applyToJobSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  resumeId: z.string().min(1, 'resumeId is required'),
});
