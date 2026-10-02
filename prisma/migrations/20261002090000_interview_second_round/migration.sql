-- Second-round AI interview (retake), requested by Company HR or the agency.
-- Every existing interview is round 1; nothing else changes.
--
-- NOTE: hand-written on purpose (the live DB still has the telephonic
-- columns that `prisma migrate diff` would drop).

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "interviews" ADD COLUMN "roundReason" TEXT;
ALTER TABLE "interviews" ADD COLUMN "roundNotes" TEXT;
ALTER TABLE "interviews" ADD COLUMN "roundRequestedById" TEXT;
ALTER TABLE "interviews" ADD COLUMN "roundRequestedByRole" TEXT;
