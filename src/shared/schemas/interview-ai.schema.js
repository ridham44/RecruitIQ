import { z } from 'zod';

// AI-generated question text for the current stage (Section 5) — validated
// before being persisted/spoken, same discipline as every other AI call in
// this app (never trust raw LLM output).
export const generatedQuestionSchema = z.object({
  question: z.string().min(1).default('Could you tell me more about your experience relevant to this role?'),
});

// Lightweight in-the-moment evaluation used ONLY to decide follow-up vs
// next question (Section 5/8) — deliberately smaller/cheaper than the final
// report evaluation.
export const answerEvaluationSchema = z.object({
  needsFollowUp: z.boolean().default(false),
  followUpQuestion: z.string().default(''),
  relevance: z.coerce.number().min(0).max(100).default(50),
  missingConcepts: z.array(z.string().max(200)).max(5).default([]),
  note: z.string().default(''),
});

// Transcript-normalization LLM pass (Section 2) — a narrow spell-correction
// output, validated the same as every other AI call before being trusted.
export const transcriptCorrectionSchema = z.object({
  correctedText: z.string().default(''),
});

// Deep, final post-interview evaluation (Section 8). Numeric scores and
// per-question analysis are structured so the UI can render them directly;
// `reasoning` is the only free-text field.
export const interviewReportSchema = z.object({
  overallScore: z.coerce.number().min(0).max(100).default(0),
  technicalScore: z.coerce.number().min(0).max(100).default(0),
  communicationScore: z.coerce.number().min(0).max(100).default(0),
  strengths: z.array(z.string()).default([]),
  areasForImprovement: z.array(z.string()).default([]),
  questionAnalysis: z
    .array(
      z.object({
        questionId: z.string().default(''),
        question: z.string().default(''),
        answerSummary: z.string().default(''),
        // Structured rubric (Section 13) — kept distinct so grammar/accent/
        // filler-word/STT-error concerns never bleed into the technical read.
        correctness: z.coerce.number().min(0).max(100).default(0),
        relevance: z.coerce.number().min(0).max(100).default(0),
        technicalDepth: z.coerce.number().min(0).max(100).default(0),
        communication: z.coerce.number().min(0).max(100).default(0),
        score: z.coerce.number().min(0).max(100).default(0),
        strengths: z.array(z.string()).default([]),
        missingConcepts: z.array(z.string()).default([]),
        evaluationReason: z.string().default(''),
      })
    )
    .default([]),
  reasoning: z.string().default(''),
});
