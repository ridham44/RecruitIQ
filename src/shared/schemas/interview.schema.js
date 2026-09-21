import { z } from 'zod';
import { INTERVIEW_EVENT_TYPE } from '../constants/statuses.js';

// Company configures the AI interviewer for a job (Section 1).
export const upsertInterviewConfigSchema = z.object({
  aiName: z.string().min(1).max(60).default('Priya'),
  aiTitle: z.string().min(1).max(80).default('Virtual HR'),
  questionCount: z.coerce.number().int().min(3).max(30).default(10),
  answerTimeSeconds: z.coerce.number().int().min(10).max(300).default(30),
  customQuestions: z.array(z.string().min(1).max(500)).max(20).default([]),
});

// Browser -> backend: a security/monitoring event observed during the
// interview (Section 4). `metadata` is small, optional, freeform context
// (e.g. which tab regained focus) — never video/audio content.
export const logInterviewEventSchema = z.object({
  type: z.enum(Object.values(INTERVIEW_EVENT_TYPE)),
  metadata: z.record(z.any()).optional(),
});

// The final transcript for the currently active question (Section 5) —
// used both by the candidate's browser (push-to-talk Send button) and by
// the legacy livekit-worker route.
export const submitAnswerSchema = z.object({
  questionId: z.string().min(1),
  transcript: z.string().default(''),
  durationSeconds: z.coerce.number().min(0).optional(),
  timedOut: z.boolean().default(false),
});
