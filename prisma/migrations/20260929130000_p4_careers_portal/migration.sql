-- Build plan P4: careers portal, guest apply with phone OTP, CV-only
-- matching and per-job auto-advance. Additive only — every new column is
-- nullable or has a default that reproduces today's behavior
-- (source = DIRECT, passwordSet = true, autoAdvanceOnMatch = false).
--
-- NOTE: hand-written on purpose — `prisma migrate diff` against the live DB
-- also proposes dropping the telephonic-interview columns still present in
-- the database; those are deliberately left untouched here.

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('DIRECT', 'GUEST', 'AUTO_MATCH');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "source" "ApplicationSource" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "autoAdvanceOnMatch" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordSet" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "phone_otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'APPLY',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_uploads" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "rawText" TEXT,
    "parsedData" JSONB,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_submissions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "matchResults" JSONB,
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_otps_phone_createdAt_idx" ON "phone_otps"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "phone_otps_ip_createdAt_idx" ON "phone_otps"("ip", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cv_submissions_applicationId_key" ON "cv_submissions"("applicationId");

-- CreateIndex
CREATE INDEX "cv_submissions_companyId_idx" ON "cv_submissions"("companyId");

-- CreateIndex
CREATE INDEX "cv_submissions_candidateId_idx" ON "cv_submissions"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- AddForeignKey
ALTER TABLE "cv_submissions" ADD CONSTRAINT "cv_submissions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_submissions" ADD CONSTRAINT "cv_submissions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_submissions" ADD CONSTRAINT "cv_submissions_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_submissions" ADD CONSTRAINT "cv_submissions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
