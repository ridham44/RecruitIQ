-- Build plan P1 (enum additions go in their own migration — see plan rule 6).
-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'ACCOUNT_SETUP';
