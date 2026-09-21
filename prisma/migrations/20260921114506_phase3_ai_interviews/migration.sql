-- CreateEnum
CREATE TYPE "InterviewStage" AS ENUM ('NOT_STARTED', 'INTRODUCTION', 'RESUME_QUESTIONS', 'BASIC_TECHNICAL', 'JOB_SPECIFIC', 'SCENARIO', 'BEHAVIORAL', 'CANDIDATE_QUESTIONS', 'END');

-- CreateEnum
CREATE TYPE "InterviewQuestionType" AS ENUM ('INTRODUCTION', 'CUSTOM', 'RESUME_BASED', 'TECHNICAL', 'JOB_SPECIFIC', 'SCENARIO', 'FOLLOW_UP', 'BEHAVIORAL', 'CANDIDATE_QUESTION');

-- CreateEnum
CREATE TYPE "InterviewEventType" AS ENUM ('CAMERA_ON', 'CAMERA_OFF', 'MIC_ON', 'MIC_OFF', 'TAB_SWITCH', 'PAGE_LEFT', 'FULLSCREEN_EXIT', 'CONNECTION_LOST', 'CONNECTION_RESTORED', 'INTERVIEW_STARTED', 'INTERVIEW_ENDED');

-- CreateEnum
CREATE TYPE "InterviewReportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "InterviewStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "liveKitRoomName" TEXT,
ADD COLUMN     "plannedQuestionIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stage" "InterviewStage" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ai_interview_configs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "aiName" TEXT NOT NULL DEFAULT 'Priya',
    "aiTitle" TEXT NOT NULL DEFAULT 'Virtual HR',
    "questionCount" INTEGER NOT NULL DEFAULT 10,
    "answerTimeSeconds" INTEGER NOT NULL DEFAULT 30,
    "customQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_interview_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "stage" "InterviewStage" NOT NULL,
    "type" "InterviewQuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "parentQuestionId" TEXT,
    "answerTimeLimitSeconds" INTEGER NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_answers" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    "evaluation" JSONB,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_events" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "type" "InterviewEventType" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_reports" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "status" "InterviewReportStatus" NOT NULL DEFAULT 'PENDING',
    "overallScore" DOUBLE PRECISION,
    "technicalScore" DOUBLE PRECISION,
    "communicationScore" DOUBLE PRECISION,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "areasForImprovement" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questionAnalysis" JSONB,
    "resumeAlignment" JSONB,
    "reasoning" TEXT,
    "aiModel" TEXT,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_interview_configs_jobId_key" ON "ai_interview_configs"("jobId");

-- CreateIndex
CREATE INDEX "interview_questions_interviewId_idx" ON "interview_questions"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_answers_questionId_key" ON "interview_answers"("questionId");

-- CreateIndex
CREATE INDEX "interview_events_interviewId_idx" ON "interview_events"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_reports_interviewId_key" ON "interview_reports"("interviewId");

-- AddForeignKey
ALTER TABLE "ai_interview_configs" ADD CONSTRAINT "ai_interview_configs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "interview_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_events" ADD CONSTRAINT "interview_events_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_reports" ADD CONSTRAINT "interview_reports_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
