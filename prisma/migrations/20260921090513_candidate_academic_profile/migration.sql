-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "AcademicStatus" AS ENUM ('ONGOING', 'COMPLETED');

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "academicStatus" "AcademicStatus",
ADD COLUMN     "college" TEXT,
ADD COLUMN     "currentSemester" INTEGER,
ADD COLUMN     "degree" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "latestSpi" DOUBLE PRECISION,
ADD COLUMN     "university" TEXT;
