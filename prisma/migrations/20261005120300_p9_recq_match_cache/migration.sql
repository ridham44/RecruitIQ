-- Build plan P9 (/recq): the resume ↔ job match computed when the candidate
-- uploads is kept with the upload, so applying reuses exactly the score the
-- candidate was shown (one AI call, no second, possibly different, score).
-- Server-side only; additive and nullable.

-- AlterTable
ALTER TABLE "guest_uploads" ADD COLUMN "recqMatches" JSONB;
