import { z } from 'zod';
import { INTERVIEW_EVENT_TYPE } from '../constants/statuses.js';

// Company configures the AI interviewer for a job (Section 1).
export const upsertInterviewConfigSchema = z
  .object({
    aiName: z.string().min(1).max(60).default('Priya'),
    aiTitle: z.string().min(1).max(80).default('Virtual HR'),
    questionCount: z.coerce.number().int().min(3).max(30).default(10),
    answerTimeSeconds: z.coerce.number().int().min(10).max(300).default(30),
    customQuestions: z.array(z.string().min(1).max(500)).max(20).default([]),
    // Section 8: explicit voice config, never inferred from aiName.
    voiceGender: z.enum(['FEMALE', 'MALE', 'NEUTRAL']).default('FEMALE'),
    // Nullable (not just optional): the API itself returns `ttsVoiceId: null`
    // when unset, so a client that reads the config and writes it straight
    // back (e.g. the company's save form, or any round-trip) must be able to
    // send that same null through, not just omit the field entirely.
    ttsVoiceId: z.string().max(100).nullable().optional(),
    // Section 5: adaptive by default; FIXED holds every question at MEDIUM.
    difficultyStrategy: z.enum(['FIXED', 'ADAPTIVE']).default('ADAPTIVE'),
  })
  // Custom questions are mandatory and must ALL be asked (Section 1: "the
  // AI must ask") — one slot is always reserved for the closing "any
  // questions for us?" turn, so at most questionCount - 1 of them can ever
  // fit. Rejecting the overflow here (rather than silently truncating,
  // interviewEngine.service.js's buildStagePlan still caps as a runtime
  // safety net) keeps the company's saved config the source of truth for
  // what will actually be asked.
  .refine((data) => data.customQuestions.length <= Math.max(0, data.questionCount - 1), {
    message: 'Number of custom questions cannot exceed (Number of questions - 1)',
    path: ['customQuestions'],
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
  // Legacy/fallback raw-text field — the livekit-worker route only ever
  // sends this. The browser sends both this and rawTranscript (Section 2).
  transcript: z.string().default(''),
  rawTranscript: z.string().optional(),
  correctedTranscript: z.string().max(6000).optional(),
  manuallyCorrected: z.boolean().default(false),
  sttConfidence: z.coerce.number().min(0).max(1).optional(),
  durationSeconds: z.coerce.number().min(0).optional(),
  timedOut: z.boolean().default(false),
});
