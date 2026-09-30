-- Build plan P1: Platform Admin & onboarding. Additive only — existing
-- companies become ACTIVE through the column default, nothing is dropped.
--
-- NOTE: hand-written on purpose. `prisma migrate diff` against the live DB
-- also proposes dropping the telephonic-interview columns still present in
-- the database (interviews.mode/callStatus/…, interview_slots.mode) — those
-- are deliberately left untouched here.

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "createdByAdminId" TEXT,
ADD COLUMN     "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateTable
CREATE TABLE "password_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'INVITE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_tokens_tokenHash_key" ON "password_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_tokens_userId_idx" ON "password_tokens"("userId");

-- AddForeignKey
ALTER TABLE "password_tokens" ADD CONSTRAINT "password_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
