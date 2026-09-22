-- CreateEnum
CREATE TYPE "InterviewQuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "AiVoiceGender" AS ENUM ('FEMALE', 'MALE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "DifficultyStrategy" AS ENUM ('FIXED', 'ADAPTIVE');

-- AlterTable
ALTER TABLE "ai_interview_configs" ADD COLUMN     "difficultyStrategy" "DifficultyStrategy" NOT NULL DEFAULT 'ADAPTIVE',
ADD COLUMN     "ttsVoiceId" TEXT,
ADD COLUMN     "voiceGender" "AiVoiceGender" NOT NULL DEFAULT 'FEMALE';

-- AlterTable
ALTER TABLE "interview_answers" ADD COLUMN     "correctedTranscript" TEXT,
ADD COLUMN     "manuallyCorrected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "normalizedTranscript" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rawTranscript" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sttConfidence" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "interview_questions" ADD COLUMN     "difficulty" "InterviewQuestionDifficulty";
