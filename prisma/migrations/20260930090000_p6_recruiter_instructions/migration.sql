-- Build plan P6: recruiter interview & evaluation instructions. Additive
-- only — every new column is nullable or defaults to empty, and empty means
-- the AI prompts are exactly what they were before.
--
-- NOTE: hand-written on purpose (the live DB still has the telephonic
-- columns that `prisma migrate diff` would drop).

-- AlterTable
ALTER TABLE "ai_interview_configs" ADD COLUMN     "evaluationInstructions" TEXT,
ADD COLUMN     "focusSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "interviewInstructions" TEXT;

-- AlterTable
ALTER TABLE "interview_reports" ADD COLUMN     "criteriaAssessment" JSONB;
