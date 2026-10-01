-- HR / hiring persons now belong directly to the client company ("Company");
-- the department becomes optional. Existing rows are moved to the company
-- their department belongs to, so no data is lost.
--
-- NOTE: hand-written on purpose (the live DB still has the telephonic
-- columns that `prisma migrate diff` would drop).

-- AlterTable: new owner column, filled from the department
ALTER TABLE "hiring_persons" ADD COLUMN "clientCompanyId" TEXT;
UPDATE "hiring_persons" h SET "clientCompanyId" = d."clientCompanyId" FROM "departments" d WHERE d."id" = h."departmentId";
ALTER TABLE "hiring_persons" ALTER COLUMN "clientCompanyId" SET NOT NULL;

-- AlterTable: department is optional
ALTER TABLE "hiring_persons" ALTER COLUMN "departmentId" DROP NOT NULL;

-- Deactivating/removing a department no longer removes its HR people.
ALTER TABLE "hiring_persons" DROP CONSTRAINT "hiring_persons_departmentId_fkey";
ALTER TABLE "hiring_persons" ADD CONSTRAINT "hiring_persons_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey / index for the new column
ALTER TABLE "hiring_persons" ADD CONSTRAINT "hiring_persons_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "client_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "hiring_persons_clientCompanyId_idx" ON "hiring_persons"("clientCompanyId");

-- Compatibility: code deployed before this change still creates HR people
-- with only a departmentId. Fill the company from the department so those
-- inserts keep working until the new code is live.
CREATE OR REPLACE FUNCTION hiring_persons_fill_client_company() RETURNS trigger AS $$
BEGIN
  IF NEW."clientCompanyId" IS NULL AND NEW."departmentId" IS NOT NULL THEN
    SELECT "clientCompanyId" INTO NEW."clientCompanyId" FROM "departments" WHERE "id" = NEW."departmentId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hiring_persons_fill_client_company
  BEFORE INSERT ON "hiring_persons"
  FOR EACH ROW EXECUTE FUNCTION hiring_persons_fill_client_company();
