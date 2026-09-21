import { z } from 'zod';

export const applyToJobSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  resumeId: z.string().min(1, 'resumeId is required'),
});

// Manual bulk Shortlist/Reject action — deliberately restricted to these two
// terminal statuses; APPLIED/SCREENING are system-managed and not something
// a company sets directly.
export const bulkUpdateApplicationStatusSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1, 'Select at least one application'),
  status: z.enum(['SHORTLISTED', 'REJECTED']),
});
