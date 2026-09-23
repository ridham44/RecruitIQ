import { z } from 'zod';

export const educationSchema = z.object({
  degree: z.string().min(1, 'Degree is required').max(200),
  fieldOfStudy: z.string().max(200).optional().nullable(),
  institution: z.string().max(300).optional().nullable(),
  startYear: z.number().int().min(1900).max(2100).optional().nullable(),
  endYear: z.number().int().min(1900).max(2100).optional().nullable(),
  isCurrentlyStudying: z.boolean().optional().default(false),
  grade: z.string().max(50).optional().nullable(),
});

export const updateEducationSchema = educationSchema.partial().extend({
  // at least degree must stay non-null on update if provided
});
