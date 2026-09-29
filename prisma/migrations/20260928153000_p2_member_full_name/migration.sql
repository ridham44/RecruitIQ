-- Build plan P2: display name for recruiters. Additive, nullable.
-- AlterTable
ALTER TABLE "company_members" ADD COLUMN "fullName" TEXT;
