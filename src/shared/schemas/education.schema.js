import { z } from 'zod';
import { requiredText, optionalText, CURRENT_YEAR } from './common.js';

const year = (label, max) =>
  z
    .number({ invalid_type_error: `${label} must be a year` })
    .int(`${label} must be a whole year`)
    .min(1950, `${label} must be 1950 or later`)
    .max(max, `${label} can't be later than ${max}`)
    .optional()
    .nullable();

const educationFields = z.object({
  degree: requiredText('Degree', 200),
  fieldOfStudy: optionalText('Field of study', 200),
  institution: optionalText('University / Institution', 300),
  startYear: year('Start year', CURRENT_YEAR),
  endYear: year('End year', CURRENT_YEAR + 10),
  isCurrentlyStudying: z.boolean().optional(),
  grade: optionalText('Grade', 50),
});

function checkYears(data, ctx) {
  if (data.startYear != null && data.endYear != null && data.endYear < data.startYear) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endYear'], message: "End year can't be before the start year" });
  }
  if (data.isCurrentlyStudying === false && data.endYear != null && data.endYear > CURRENT_YEAR + 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endYear'], message: 'A finished course can’t end in the future — tick "Currently studying here"' });
  }
}

export const educationSchema = educationFields
  .extend({ isCurrentlyStudying: z.boolean().optional().default(false) })
  .superRefine(checkYears);

export const updateEducationSchema = educationFields.partial().superRefine(checkYears);
