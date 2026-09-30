-- Build plan P8 (enum additions go in their own migration — see plan rule 6).
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLIENT_HR';
