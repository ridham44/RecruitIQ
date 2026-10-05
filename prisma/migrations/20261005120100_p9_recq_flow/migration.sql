-- Build plan P9 (/recq flow): the agency-link candidate journey.
-- Additive only — every new column is nullable, so existing rows and the
-- current careers/guest flow keep working unchanged.
--
--  * jobs.slug                       public per-agency job slug for
--                                    /recq/:agencySlug/:jobSlug (unique per
--                                    company; many NULLs allowed until
--                                    backfilled or next touched).
--  * jobs.interviewAvailabilityStart agency-configured interview window,
--  * jobs.interviewAvailabilityEnd   enforced on the backend (both NULL =
--                                    no fixed window, link follows
--                                    inviteValidDays exactly as before).
--  * email_otps                      one-time email verification codes,
--                                    mirroring phone_otps.

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "slug" TEXT;
ALTER TABLE "jobs" ADD COLUMN     "interviewAvailabilityStart" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN     "interviewAvailabilityEnd" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'RECQ_APPLY',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_otps_email_createdAt_idx" ON "email_otps"("email", "createdAt");

-- CreateIndex
CREATE INDEX "email_otps_ip_createdAt_idx" ON "email_otps"("ip", "createdAt");

-- CreateIndex
-- Unique per company; NULL slugs are distinct in Postgres, so existing jobs
-- without a slug never collide.
CREATE UNIQUE INDEX "jobs_companyId_slug_key" ON "jobs"("companyId", "slug");
