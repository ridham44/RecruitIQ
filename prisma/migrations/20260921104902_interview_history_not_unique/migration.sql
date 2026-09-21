-- DropIndex
DROP INDEX "interviews_applicationId_key";

-- DropIndex
DROP INDEX "interviews_slotId_key";

-- CreateIndex
CREATE INDEX "interviews_applicationId_idx" ON "interviews"("applicationId");

-- CreateIndex
CREATE INDEX "interviews_slotId_idx" ON "interviews"("slotId");
