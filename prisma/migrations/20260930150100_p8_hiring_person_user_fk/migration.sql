-- Build plan P8: hiring_persons.userId (added nullable in P3, never set until
-- now) becomes a real foreign key to the portal login. Deleting the user
-- just unlinks the HR person. Additive; no existing data changes.
--
-- NOTE: hand-written on purpose (the live DB still has the telephonic
-- columns that `prisma migrate diff` would drop).

-- AddForeignKey
ALTER TABLE "hiring_persons" ADD CONSTRAINT "hiring_persons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
