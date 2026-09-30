-- Build plan P7: final score, final threshold and client submissions.
-- Additive only: finalThreshold is null for every existing job (feature off),
-- weights default to 30% CV / 70% interview, auto-submit is off.
--
-- NOTE: hand-written on purpose (the live DB still has the telephonic
-- columns that `prisma migrate diff` would drop).

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "finalScore" DOUBLE PRECISION,
ADD COLUMN     "finalScoredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "autoSubmitToClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cvWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
ADD COLUMN     "finalThreshold" DOUBLE PRECISION,
ADD COLUMN     "interviewWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.7;

-- CreateTable
CREATE TABLE "client_submissions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "departmentId" TEXT,
    "hiringPersonId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "viewedAt" TIMESTAMP(3),
    "accessTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_submissions_accessTokenHash_key" ON "client_submissions"("accessTokenHash");

-- CreateIndex
CREATE INDEX "client_submissions_applicationId_idx" ON "client_submissions"("applicationId");

-- CreateIndex
CREATE INDEX "client_submissions_hiringPersonId_idx" ON "client_submissions"("hiringPersonId");

-- CreateIndex
CREATE INDEX "client_submissions_clientCompanyId_idx" ON "client_submissions"("clientCompanyId");

-- AddForeignKey
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "client_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_hiringPersonId_fkey" FOREIGN KEY ("hiringPersonId") REFERENCES "hiring_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
