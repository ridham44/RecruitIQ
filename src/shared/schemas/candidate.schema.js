import { z } from 'zod';

export const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
export const ACADEMIC_STATUS_OPTIONS = ['ONGOING', 'COMPLETED'];

// Candidate profile update (Section 4/5). currentSemester only makes sense
// while academicStatus is ONGOING; latestSpi is either the "latest SPI"
// (ongoing) or "final SPI" (completed) depending on that same field — the
// UI is responsible for labeling it accordingly.
export const updateCandidateSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    phone: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    headline: z.string().optional().nullable(),
    skills: z.array(z.string()).optional(),
    gender: z.enum(GENDER_OPTIONS).optional().nullable(),
    university: z.string().optional().nullable(),
    college: z.string().optional().nullable(),
    degree: z.string().optional().nullable(),
    academicStatus: z.enum(ACADEMIC_STATUS_OPTIONS).optional().nullable(),
    currentSemester: z.coerce.number().int().min(1).max(12).optional().nullable(),
    latestSpi: z.coerce.number().min(0).max(10).optional().nullable(),
  })
  .refine((data) => data.academicStatus !== 'COMPLETED' || !data.currentSemester, {
    message: 'currentSemester only applies while academicStatus is ONGOING',
    path: ['currentSemester'],
  });
