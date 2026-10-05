import { z } from 'zod';
import { optionalText, idSchema } from './common.js';

const MAX_SLOT_MINUTES = 8 * 60;
const MAX_DAYS_AHEAD = 365;
// A little slack so a slot created "now" from a slow form isn't rejected.
const notInPast = (d) => d.getTime() > Date.now() - 15 * 60 * 1000;
const notTooFar = (d) => d.getTime() < Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;

const dateField = (label) =>
  z.coerce.date({ errorMap: () => ({ message: `${label} must be a valid date and time` }) });

const slotSchema = z
  .object({
    startTime: dateField('Start time'),
    endTime: dateField('End time'),
  })
  .superRefine((slot, ctx) => {
    if (!(slot.endTime > slot.startTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'End time must be after start time' });
    } else if (slot.endTime - slot.startTime > MAX_SLOT_MINUTES * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'A slot can be at most 8 hours long' });
    }
    if (!notInPast(slot.startTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startTime'], message: "Start time can't be in the past" });
    } else if (!notTooFar(slot.startTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startTime'], message: 'Start time must be within the next year' });
    }
  });

// Company creates one or more slots for a job in one request.
export const createSlotsSchema = z.object({
  slots: z.array(slotSchema).min(1, 'Provide at least one slot').max(100, 'Add at most 100 slots at a time'),
});

// Second-round AI interview request (agency or Company HR).
export const secondRoundSchema = z.object({
  reason: z.enum(['TECHNICAL_ISSUE', 'NOT_READY', 'NEED_MORE_DETAIL', 'OTHER'], {
    errorMap: () => ({ message: 'Choose a reason' }),
  }),
  notes: optionalText('Notes', 1000),
});

// Candidate books a specific slot for one of their applications.
export const bookSlotSchema = z.object({
  slotId: idSchema('slotId'),
});

// Company generates evenly-spaced slots across a time range (Phase 2.5:
// "Create AI Interview Slots") — the range is a precise start/end instant
// (already combined from a date + time in the browser's local timezone, the
// same way the manual single-slot form does it) so the server never has to
// guess a timezone from a bare date/time string; the actual slot-count
// arithmetic (splitting the range into N slots) happens server-side.
export const generateSlotsSchema = z
  .object({
    rangeStart: dateField('Start'),
    rangeEnd: dateField('End'),
    durationMinutes: z.coerce
      .number({ invalid_type_error: 'Duration must be a number' })
      .int('Duration must be whole minutes')
      .min(5, 'Duration must be at least 5 minutes')
      .max(240, 'Duration can be at most 240 minutes'),
    bufferMinutes: z.coerce
      .number({ invalid_type_error: 'Buffer must be a number' })
      .int('Buffer must be whole minutes')
      .min(0, "Buffer can't be negative")
      .max(120, 'Buffer can be at most 120 minutes')
      .default(0),
  })
  .superRefine((data, ctx) => {
    if (!(data.rangeEnd > data.rangeStart)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rangeEnd'], message: 'End must be after start' });
      return;
    }
    if (data.rangeEnd - data.rangeStart > 24 * 60 * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rangeEnd'], message: 'Generate slots for at most 24 hours at a time' });
    }
    if (data.rangeEnd - data.rangeStart < data.durationMinutes * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['durationMinutes'], message: 'The time range is shorter than one interview' });
    }
    if (!notInPast(data.rangeStart)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rangeStart'], message: "Start can't be in the past" });
    } else if (!notTooFar(data.rangeStart)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rangeStart'], message: 'Start must be within the next year' });
    }
  });
