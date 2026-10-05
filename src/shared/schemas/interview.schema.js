import { z } from 'zod';
import { INTERVIEW_EVENT_TYPE } from '../constants/statuses.js';
import { requiredText, idSchema } from './common.js';

// Company configures the AI interviewer for a job (Section 1).
export const upsertInterviewConfigSchema = z
  .object({
    aiName: requiredText('AI interviewer name', 60).default('Priya'),
    aiTitle: requiredText('AI interviewer title', 80).default('Virtual HR'),
    questionCount: z.coerce.number().int().min(3).max(30).default(10),
    answerTimeSeconds: z.coerce.number().int().min(10).max(300).default(30),
    customQuestions: z.array(requiredText('Custom question', 500)).max(20, 'Add at most 20 custom questions').default([]),
    // Section 8: explicit voice config, never inferred from aiName.
    voiceGender: z.enum(['FEMALE', 'MALE', 'NEUTRAL']).default('FEMALE'),
    // Nullable (not just optional): the API itself returns `ttsVoiceId: null`
    // when unset, so a client that reads the config and writes it straight
    // back (e.g. the company's save form, or any round-trip) must be able to
    // send that same null through, not just omit the field entirely.
    ttsVoiceId: z.string().trim().max(100).nullable().optional(),
    // Section 5: adaptive by default; FIXED holds every question at MEDIUM.
    difficultyStrategy: z.enum(['FIXED', 'ADAPTIVE']).default('ADAPTIVE'),
    // Build plan P6 (§10, §11): recruiter guidance. Optional with no default,
    // so a client that doesn't send them leaves the saved values untouched.
    // '' / null clear them.
    interviewInstructions: z.string().trim().max(2000, 'Keep interview instructions under 2000 characters').nullable().optional(),
    evaluationInstructions: z.string().trim().max(2000, 'Keep evaluation instructions under 2000 characters').nullable().optional(),
    focusSkills: z.array(requiredText('Skill', 60)).max(20, 'Add at most 20 skills').optional(),
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
  // INTERVIEW_STARTED / INTERVIEW_ENDED are recorded by the server only.
  type: z.enum(Object.values(INTERVIEW_EVENT_TYPE).filter((t) => t !== 'INTERVIEW_STARTED' && t !== 'INTERVIEW_ENDED'), {
    errorMap: () => ({ message: 'Unknown event type' }),
  }),
  metadata: z
    .record(z.any())
    .refine((m) => JSON.stringify(m).length <= 2000, 'Event metadata is too large')
    .optional(),
});

// The final transcript for the currently active question (Section 5) —
// used both by the candidate's browser (push-to-talk Send button) and by
// the legacy livekit-worker route.
export const submitAnswerSchema = z.object({
  questionId: idSchema('questionId'),
  // Legacy/fallback raw-text field — the livekit-worker route only ever
  // sends this. The browser sends both this and rawTranscript (Section 2).
  transcript: z.string().max(10000, 'Answer is too long').default(''),
  rawTranscript: z.string().max(10000, 'Answer is too long').optional(),
  correctedTranscript: z.string().max(6000).optional(),
  manuallyCorrected: z.boolean().default(false),
  sttConfidence: z.coerce.number().min(0).max(1).optional(),
  durationSeconds: z.coerce.number().min(0).max(3600).optional(),
  timedOut: z.boolean().default(false),
});
