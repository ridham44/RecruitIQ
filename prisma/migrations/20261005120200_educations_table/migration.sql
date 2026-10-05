-- The `educations` model (schema.prisma) never had a migration of its own —
-- existing databases got the table outside migrations, so a fresh database
-- built with `prisma migrate deploy` was missing it and every candidate
-- education query failed. Idempotent on purpose: databases that already have
-- the table (and its index / foreign key) are left exactly as they are.
--
-- The legacy flat education columns on "candidates" (degree, university, …)
-- are intentionally NOT dropped here — that would be destructive.

-- CreateTable
CREATE TABLE IF NOT EXISTS "educations" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "institution" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "isCurrentlyStudying" BOOLEAN NOT NULL DEFAULT false,
    "grade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "educations_candidateId_idx" ON "educations"("candidateId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'educations_candidateId_fkey') THEN
    ALTER TABLE "educations" ADD CONSTRAINT "educations_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
