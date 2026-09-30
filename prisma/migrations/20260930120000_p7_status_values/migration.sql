-- Build plan P7 (enum additions go in their own migration — see plan rule 6).
-- Nothing writes these values until a job sets finalThreshold / a recruiter
-- submits a candidate, so existing applications are unaffected.
-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'QUALIFIED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'NOT_QUALIFIED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'SUBMITTED_TO_CLIENT';

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'CLIENT_SUBMISSION';
