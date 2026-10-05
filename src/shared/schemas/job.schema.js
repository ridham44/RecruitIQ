import { z } from 'zod';
import { EMPLOYMENT_TYPE, JOB_STATUS } from '../constants/statuses.js';
import { requiredText, optionalText, tagListSchema, idSchema } from './common.js';

const years = (label) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} can't be negative`)
    .max(50, `${label} must be 50 years or less`);

const jobFields = z.object({
  title: requiredText('Title', 200),
  description: requiredText('Description', 20000).refine((v) => v.length >= 30, 'Description must be at least 30 characters'),
  minimumExperience: years('Minimum experience').default(0),
  maximumExperience: years('Maximum experience').optional().nullable(),
  requiredSkills: tagListSchema('Required skills', { maxItems: 40 }).default([]),
  preferredSkills: tagListSchema('Preferred skills', { maxItems: 40 }).default([]),
  educationRequirements: tagListSchema('Education', { maxItems: 20, maxLength: 120 }).default([]),
  location: optionalText('Location', 200),
  employmentType: z.nativeEnum(EMPLOYMENT_TYPE).default(EMPLOYMENT_TYPE.FULL_TIME),
  workMode: z.enum(['On-site', 'Remote', 'Hybrid']).default('On-site'),
  openings: z.coerce
    .number({ invalid_type_error: 'Number of openings must be a number' })
    .int('Number of openings must be a whole number')
    .min(1, 'Number of openings must be at least 1')
    .max(1000, 'Number of openings must be 1000 or less')
    .default(1),
  numberOfOpenings: z.coerce.number().int().min(1).max(1000).optional(),
  jobLevel: z.enum(['Junior', 'Mid', 'Senior', 'Lead']).default('Mid'),
  noticePeriod: optionalText('Notice period', 60),
  languagesRequired: tagListSchema('Languages', { maxItems: 20, maxLength: 40 }).default([]),
  certifications: tagListSchema('Certifications', { maxItems: 20, maxLength: 120 }).default([]),
  salaryRange: optionalText('Salary range', 60),
  status: z.nativeEnum(JOB_STATUS).default(JOB_STATUS.OPEN),
  // Screening decision settings — see the comment on Job.minAcceptableScore
  // in schema.prisma. autoRejectBelowMinScore only ever auto-rejects; it
  // never auto-shortlists.
  minAcceptableScore: z.coerce.number().min(0, 'Score must be 0–100').max(100, 'Score must be 0–100').default(75),
  autoRejectBelowMinScore: z.boolean().default(false),
  // Build plan P4 (§8): screen on apply and shortlist/reject on the score.
  autoAdvanceOnMatch: z.boolean().default(false),
  // Build plan P5 (§9): SLOT = book a time slot (default), INSTANT = interview link.
  interviewFlow: z.enum(['SLOT', 'INSTANT']).default('SLOT'),
  inviteValidDays: z.coerce.number().int().min(1, 'Link must be valid for at least 1 day').max(60, 'Link can be valid for at most 60 days').default(7),
  // Build plan P7 (§12): null threshold = final-score decisions off for the job.
  finalThreshold: z.coerce.number().min(0, 'Threshold must be 0–100').max(100, 'Threshold must be 0–100').nullable().optional(),
  cvWeight: z.coerce.number().min(0).max(1).optional(),
  interviewWeight: z.coerce.number().min(0).max(1).optional(),
  autoSubmitToClient: z.boolean().optional(),
  // Build plan P3 (§5): optional Client → Department → HR person link. null
  // clears it; omitted leaves it unchanged. The chain is checked server-side.
  clientCompanyId: idSchema('company').nullable().optional(),
  departmentId: idSchema('department').nullable().optional(),
  hiringPersonId: idSchema('Company HR').nullable().optional(),
});

function checkJob(data, ctx) {
  if (data.maximumExperience != null && data.minimumExperience != null && data.maximumExperience < data.minimumExperience) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maximumExperience'], message: "Maximum experience can't be less than minimum experience" });
  }
  if (data.cvWeight != null && data.interviewWeight != null && Math.abs(data.cvWeight + data.interviewWeight - 1) > 0.001) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['interviewWeight'], message: 'CV weight and interview weight must add up to 100%' });
  }
}

export const createJobSchema = jobFields.superRefine(checkJob);

export const updateJobSchema = jobFields.partial().superRefine(checkJob);

export const publicJobsQuerySchema = z.object({
  search: z.string().trim().max(100, 'Search is too long').optional(),
});

// "none" = jobs without a company (client).
export const companyJobsQuerySchema = z.object({
  clientId: idSchema('clientId').optional(),
});
