-- Build plan P3: client companies → departments → HR / hiring persons,
-- client ↔ recruiter assignments, and an optional client link on jobs.
-- Additive only: the three job columns are nullable, so every existing job
-- keeps working with no client attached.
--
-- NOTE: hand-written on purpose — `prisma migrate diff` against the live DB
-- also proposes dropping the telephonic-interview columns still present in
-- the database; those are deliberately left untouched here.

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "clientCompanyId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "hiringPersonId" TEXT;

-- CreateTable
CREATE TABLE "client_companies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "clientCompanyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring_persons" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "designation" TEXT,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hiring_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_recruiters" (
    "clientCompanyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_recruiters_pkey" PRIMARY KEY ("clientCompanyId","memberId")
);

-- CreateIndex
CREATE INDEX "client_companies_companyId_idx" ON "client_companies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_clientCompanyId_name_key" ON "departments"("clientCompanyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "hiring_persons_userId_key" ON "hiring_persons"("userId");

-- CreateIndex
CREATE INDEX "hiring_persons_departmentId_idx" ON "hiring_persons"("departmentId");

-- CreateIndex
CREATE INDEX "client_recruiters_memberId_idx" ON "client_recruiters"("memberId");

-- CreateIndex
CREATE INDEX "jobs_clientCompanyId_idx" ON "jobs"("clientCompanyId");

-- AddForeignKey
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_persons" ADD CONSTRAINT "hiring_persons_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_recruiters" ADD CONSTRAINT "client_recruiters_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_recruiters" ADD CONSTRAINT "client_recruiters_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "client_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_hiringPersonId_fkey" FOREIGN KEY ("hiringPersonId") REFERENCES "hiring_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
