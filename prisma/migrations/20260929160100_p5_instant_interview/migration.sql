-- Build plan P5: instant interview link. Additive only.
--   * jobs.interviewFlow defaults to SLOT, so every existing job keeps slot booking.
--   * interviews.slotId becomes nullable (relaxing NOT NULL is safe — every
--     existing interview has a slot).
--
-- NOTE: hand-written on purpose — `prisma migrate diff` against the live DB
-- also proposes dropping the telephonic-interview columns still present on
-- "interviews" (mode, callStatus, …) in the same ALTER; those are left untouched.

-- CreateEnum
CREATE TYPE "InterviewFlow" AS ENUM ('SLOT', 'INSTANT');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "interviewFlow" "InterviewFlow" NOT NULL DEFAULT 'SLOT',
ADD COLUMN     "inviteValidDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "accessTokenHash" TEXT,
ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteNonce" TEXT,
ADD COLUMN     "inviteSendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "inviteSendWindowAt" TIMESTAMP(3),
ADD COLUMN     "inviteSentAt" TIMESTAMP(3),
ALTER COLUMN "slotId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "interviews_accessTokenHash_key" ON "interviews"("accessTokenHash");
