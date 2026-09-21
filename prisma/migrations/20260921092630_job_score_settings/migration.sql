-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "autoRejectBelowMinScore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minAcceptableScore" DOUBLE PRECISION NOT NULL DEFAULT 75;
