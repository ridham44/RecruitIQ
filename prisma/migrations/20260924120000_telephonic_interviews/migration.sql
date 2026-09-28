-- Telephonic AI interviews: company picks ONLINE/PHONE per slot; booking
-- copies it onto the interview, and phone-agent/ drives the call lifecycle.

-- AlterEnum
ALTER TYPE "InterviewEventType" ADD VALUE 'CALL_DIALING';
ALTER TYPE "InterviewEventType" ADD VALUE 'CALL_ANSWERED';
ALTER TYPE "InterviewEventType" ADD VALUE 'CALL_NO_ANSWER';
ALTER TYPE "InterviewEventType" ADD VALUE 'CALL_DROPPED';
ALTER TYPE "InterviewEventType" ADD VALUE 'CALL_ENDED';

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('ONLINE', 'PHONE');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('PENDING', 'DIALING', 'IN_CALL', 'COMPLETED', 'NO_ANSWER', 'FAILED');

-- AlterTable
ALTER TABLE "interview_slots" ADD COLUMN     "mode" "InterviewMode" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "callAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "callEndedAt" TIMESTAMP(3),
ADD COLUMN     "callStartedAt" TIMESTAMP(3),
ADD COLUMN     "callStatus" "CallStatus",
ADD COLUMN     "mode" "InterviewMode" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "nextCallAt" TIMESTAMP(3),
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "twilioCallSid" TEXT;

-- CreateIndex
CREATE INDEX "interviews_mode_callStatus_idx" ON "interviews"("mode", "callStatus");
