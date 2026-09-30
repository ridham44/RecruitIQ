-- Build plan P2: recruitment company members (owners + recruiters) and
-- recruiter ↔ job assignments. Additive only.
--
-- NOTE: hand-written on purpose — `prisma migrate diff` against the live DB
-- also proposes dropping the telephonic-interview columns still present in
-- the database; those are deliberately left untouched here.

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'RECRUITER');

-- CreateTable
CREATE TABLE "company_members" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'RECRUITER',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_recruiters" (
    "jobId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_recruiters_pkey" PRIMARY KEY ("jobId","memberId")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_members_userId_key" ON "company_members"("userId");

-- CreateIndex
CREATE INDEX "company_members_companyId_idx" ON "company_members"("companyId");

-- CreateIndex
CREATE INDEX "job_recruiters_memberId_idx" ON "job_recruiters"("memberId");

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_recruiters" ADD CONSTRAINT "job_recruiters_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_recruiters" ADD CONSTRAINT "job_recruiters_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing company owner becomes an OWNER member, so all
-- ownership checks give exactly the same result as before this migration.
INSERT INTO "company_members" ("id", "companyId", "userId", "role", "permissions", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", c."userId", 'OWNER', ARRAY[]::TEXT[], true, now(), now()
FROM "companies" c
ON CONFLICT ("userId") DO NOTHING;
