-- Second-round interview: email to the agency when Company HR requests one.
-- Own migration (a new enum value can't be used in the same transaction).
-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'SECOND_ROUND_REQUESTED';
