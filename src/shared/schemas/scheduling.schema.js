import { z } from 'zod';

// Company decides per slot whether the AI interview is in-app or by phone.
export const interviewModeSchema = z.enum(['ONLINE', 'PHONE']).default('ONLINE');

// E.164 (+<country><number>, 8-15 digits) — what Twilio dials. Spaces,
// dashes and brackets are stripped first so "+91 98765-43210" is accepted.
export const phoneNumberSchema = z
  .string()
  .transform((value) => value.replace(/[\s\-().]/g, ''))
  .refine((value) => /^\+[1-9]\d{7,14}$/.test(value), {
    message: 'Enter the phone number with country code, e.g. +919876543210',
  });

const slotSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    mode: interviewModeSchema,
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
// phoneNumber is only used (and then required — enforced in bookSlot, which
// knows the slot's mode) when booking a PHONE slot.
export const bookSlotSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
  phoneNumber: phoneNumberSchema.optional(),
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
    mode: interviewModeSchema,
  })
  .refine((data) => data.rangeEnd > data.rangeStart, {
    message: 'rangeEnd must be after rangeStart',
    path: ['rangeEnd'],
  });
