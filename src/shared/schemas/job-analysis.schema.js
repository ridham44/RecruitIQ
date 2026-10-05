import { z } from 'zod';
import { EMPLOYMENT_TYPE } from '../constants/statuses.js';

// Anything the AI returns that doesn't fit becomes null / [] instead of failing
// the whole extraction — a bad guess for one field never blocks the others.
const loose = (schema, fallback) => schema.catch(fallback);
const text = (max) => loose(z.string().trim().max(max).nullable().transform((v) => v || null), null);
const list = (maxItems, maxLength) =>
  loose(
    z
      .array(z.unknown())
      .transform((arr) =>
        arr
          .filter((v) => typeof v === 'string')
          .map((v) => v.trim())
          .filter((v) => v && v.length <= maxLength && !/[<>]/.test(v))
          .filter((v, i, all) => all.findIndex((w) => w.toLowerCase() === v.toLowerCase()) === i)
          .slice(0, maxItems),
      ),
    [],
  );
const years = loose(z.coerce.number().min(0).max(50).nullable(), null);

// Shape the AI is instructed to return when extracting structured
// requirements from a job description (Section 12). null / [] = not stated.
export const jobAnalysisSchema = z.object({
  requiredSkills: list(40, 60).default([]),
  preferredSkills: list(40, 60).default([]),
  minimumExperience: years.default(null),
  maximumExperience: years.default(null),
  education: list(20, 120).default([]),
  summary: loose(z.string().trim().max(1000), '').default(''),
  location: text(200).default(null),
  workMode: loose(z.enum(['On-site', 'Remote', 'Hybrid']).nullable(), null).default(null),
  employmentType: loose(z.nativeEnum(EMPLOYMENT_TYPE).nullable(), null).default(null),
  jobLevel: loose(z.enum(['Junior', 'Mid', 'Senior', 'Lead']).nullable(), null).default(null),
  openings: loose(z.coerce.number().int().min(1).max(1000).nullable(), null).default(null),
  noticePeriod: text(60).default(null),
  salaryRange: text(60).default(null),
  languagesRequired: list(20, 40).default([]),
  certifications: list(20, 120).default([]),
});

// Job fields the AI may fill when the user left them untouched.
export const AUTO_FILL_FIELDS = [
  'minimumExperience',
  'maximumExperience',
  'educationRequirements',
  'location',
  'workMode',
  'employmentType',
  'jobLevel',
  'openings',
  'noticePeriod',
  'salaryRange',
  'languagesRequired',
  'certifications',
];

// Maps an analysis onto job fields: { field: value } for every field the
// description actually states. Skills are merged separately.
export function analysisToJobFields(analysis) {
  const out = {};
  const set = (key, value) => {
    if (value == null || (Array.isArray(value) && value.length === 0)) return;
    out[key] = value;
  };
  set('minimumExperience', analysis.minimumExperience);
  set('maximumExperience', analysis.maximumExperience);
  set('educationRequirements', analysis.education);
  set('location', analysis.location);
  set('workMode', analysis.workMode);
  set('employmentType', analysis.employmentType);
  set('jobLevel', analysis.jobLevel);
  set('openings', analysis.openings);
  set('noticePeriod', analysis.noticePeriod);
  set('salaryRange', analysis.salaryRange);
  set('languagesRequired', analysis.languagesRequired);
  set('certifications', analysis.certifications);
  if (out.minimumExperience != null && out.maximumExperience != null && out.maximumExperience < out.minimumExperience) {
    delete out.maximumExperience;
  }
  return out;
}
