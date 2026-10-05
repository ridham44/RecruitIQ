import { z } from 'zod';
import { idSchema } from './common.js';

export const applyToJobSchema = z.object({
  jobId: idSchema('jobId'),
  resumeId: idSchema('resumeId'),
});

// Manual bulk Shortlist/Reject action — deliberately restricted to these two
// terminal statuses; APPLIED/SCREENING are system-managed and not something
// a company sets directly.
export const bulkUpdateApplicationStatusSchema = z.object({
  applicationIds: z
    .array(idSchema('application id'))
    .min(1, 'Select at least one application')
    .max(500, 'Select at most 500 applications at a time')
    .transform((list) => [...new Set(list)]),
  status: z.enum(['SHORTLISTED', 'REJECTED'], { errorMap: () => ({ message: 'Status must be SHORTLISTED or REJECTED' }) }),
});
