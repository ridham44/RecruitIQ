import { z } from 'zod';

const slotSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((slot) => slot.endTime > slot.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

// Company creates one or more slots for a job in one request.
export const createSlotsSchema = z.object({
  slots: z.array(slotSchema).min(1, 'Provide at least one slot'),
});

// Candidate books a specific slot for one of their applications.
export const bookSlotSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
});

// Company generates evenly-spaced slots across a time range (Phase 2.5:
// "Create AI Interview Slots") — the range is a precise start/end instant
// (already combined from a date + time in the browser's local timezone, the
// same way the manual single-slot form does it) so the server never has to
// guess a timezone from a bare date/time string; the actual slot-count
// arithmetic (splitting the range into N slots) happens server-side.
export const generateSlotsSchema = z
  .object({
    rangeStart: z.coerce.date(),
    rangeEnd: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(5).max(240),
    bufferMinutes: z.coerce.number().int().min(0).max(120).default(0),
  })
  .refine((data) => data.rangeEnd > data.rangeStart, {
    message: 'rangeEnd must be after rangeStart',
    path: ['rangeEnd'],
  });
