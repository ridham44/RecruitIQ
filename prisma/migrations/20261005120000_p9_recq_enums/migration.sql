-- Build plan P9 (/recq flow): new enum values. Kept in their own migration —
-- a new enum value can't be added and used in the same transaction, and
-- Prisma runs each migration file in one. Nothing here uses the values yet.

-- AlterEnum
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'RECQ';

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'OTP_VERIFICATION';
