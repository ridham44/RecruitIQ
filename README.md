# RecruitIQ — AI Recruitment Platform

An AI-powered recruitment platform. Companies post jobs, candidates apply with a resume, and an AI
pipeline parses resumes, extracts structured job requirements, and scores/ranks candidates against each
job. Once shortlisted, candidates are emailed and book their own interview from company-published slots.

## What it does

**Company:** register → post a job (AI extracts structured requirements from the description) → review
applicants → run AI screening → filter/sort candidates by score, experience, skills, education, status →
shortlist or reject (in bulk) → candidates are emailed automatically → publish interview slots → see
bookings and mark interviews complete.

**Candidate:** register → build a profile (resume upload auto-fills academic fields, reviewed before
saving) → browse jobs → apply with a resume → track application status → once shortlisted, get an email,
pick an interview slot, reschedule if needed.

**Screening engine:** deterministic checks (skill overlap, experience range, education match) blended
with an LLM's semantic read of the resume — the LLM is never the sole source of truth, and gender/name/
other demographic data is never sent to it (see [AI & screening](#ai--screening)).

## Tech stack

| Layer      | Choice                                                           |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | React 18, Vite, Tailwind CSS, Lucide icons                        |
| Backend    | Node.js, Express (same app runs as a Vercel serverless function)  |
| Database   | PostgreSQL via Prisma ORM (any provider; built/tested on Neon)    |
| AI         | OpenRouter — model set entirely by env var, never hard-coded      |
| Auth       | JWT (Bearer token) + bcrypt — stateless, no cookies/sessions       |
| Email      | Brevo transactional API, with a console-log fallback when unset   |
| Validation | Zod schemas shared between client and server                      |

## Architecture

One Vercel project serves both the frontend and the API — no separate deployments.

```
Vercel
  ├── React (Vite) ── static build in dist/
  └── Express API (api/index.js) ── same app.js used by local dev
        ├── Postgres (Prisma)
        ├── OpenRouter (AI)
        └── Brevo (email)

Not part of this Vercel project (future, Phase 3):
  LiveKit voice agent — long-lived, doesn't fit a serverless function
```

- Local dev: Vite dev server + a plain Express server (`src/server/dev-server.js`), Vite proxies `/api/*`.
- Production: `vercel.json` rewrites `/api/*` to `api/index.js` (the same Express app) and falls back to
  `index.html` for client-side routes.
- Resumes are stored as bytes in Postgres by default (`STORAGE_DRIVER=database`) — Vercel functions have
  no persistent filesystem, so this is what makes uploads work there with zero extra setup. Swappable to
  S3/R2/Cloudinary later via `src/server/resume/storage/cloud.driver.js` — nothing else changes.
- No in-memory state, no background workers, no long-lived connections — every request is self-contained.

## Folder structure

```
src/
├── client/            React app — pages/, components/, layouts/, services/ (fetch wrappers), hooks/
├── server/
│   ├── modules/        One folder per domain: auth, companies, candidates, jobs, resumes,
│   │                    applications, screening, scheduling, notifications (interviews is a Phase 3 stub)
│   │                    Each: routes.js → controller.js → service.js → Prisma
│   ├── ai/              openrouter.service.js + resume/job/candidate analyzers
│   ├── resume/storage/  swappable storage driver (database / local / cloud)
│   ├── middleware/       auth, validate, upload, errorHandler
│   └── config/            env.js, prisma.js
└── shared/              constants + Zod schemas used by both client and server
prisma/                 schema.prisma, migrations/, seed.js
api/index.js            Vercel serverless entry point (imports server/app.js)
scripts/                manual end-to-end test scripts (see below)
```

## AI & screening

- `src/server/ai/` — one file per concern: `openrouter.service.js` (the only place that calls
  OpenRouter), `resume-analyzer`, `job-analyzer`, `candidate-matcher`. The API key never reaches the
  browser.
- Matching combines deterministic scoring (`screening/deterministic.util.js`) with the LLM's semantic
  read, weighted together — never the LLM alone.
- **Gender/name are never sent to the LLM.** The candidate-matcher only ever picks specific job-relevant
  fields into the prompt (never spreads a full object), and additionally scrubs demographic lines and
  the candidate's name out of any raw resume text before it's included — defense in depth, not just a
  prompt instruction.
- Per job, a company sets `minAcceptableScore` and `autoRejectBelowMinScore`. Screening **never
  auto-shortlists** — a screened application rests at `SCREENING` regardless of score. Auto-reject is
  opt-in; everything else needs a manual (or bulk) Shortlist/Reject decision.
- The Applications page's filters (score range, experience, skills, education, status, sort) run
  client-side over the already-fetched list — no separate filtered-query endpoint needed at this scale.

## Notifications & interview scheduling (Phase 2)

No Google Calendar / Twilio / LiveKit yet — RecruitIQ is its own scheduler for now.

- An application becoming `SHORTLISTED` or `REJECTED` (bulk action or auto-reject) triggers an email via
  `src/server/modules/notifications/email.service.js`. Driver is `brevo` when `BREVO_API_KEY` is set,
  else `console` (logs instead of sending — nothing crashes without it configured). Every attempt is
  logged to `EmailLog`.
- A company creates `InterviewSlot`s for a job — one at a time, or via **Create AI Interview Slots**
  (a time range + interview duration + optional buffer, e.g. 10:00–13:00 at 15 minutes → 12 slots
  generated automatically, skipping any that would overlap existing ones). A shortlisted candidate books
  one; booking is an atomic conditional update (`AVAILABLE` → `BOOKED`), so two candidates racing for the
  same slot can't both win it — the loser gets a clean `409`, not a crash. Booking moves the application
  to `INTERVIEW_SCHEDULED`, links the slot to the candidate's `Interview` record, and emails a
  confirmation.
- Either side cancelling frees the slot back to `AVAILABLE` and reverts the application to `SHORTLISTED`
  — that's the candidate's "Reschedule". The company marks a completed interview `INTERVIEW_COMPLETED`.

## Environment variables

Copy `.env.example` to `.env`. Minimum to run locally:

```env
DATABASE_URL=          # any Postgres provider — use the POOLED string in production
JWT_SECRET=             # required in production; app refuses to start without it there
OPENROUTER_API_KEY=
OPENROUTER_MODEL=       # e.g. openai/gpt-4o-mini — never hard-coded in code
```

Everything else (`STORAGE_DRIVER`, `BREVO_*`, `CLIENT_URL`, and Phase 3 placeholders for LiveKit/
Deepgram/Twilio) has a safe default or is optional — see the comments in `.env.example`.

## Local setup

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY, OPENROUTER_MODEL
npx prisma migrate dev
npm run dev                 # client on :5173, API on :3001, proxied together
```

No local Postgres install needed — Docker works:

```bash
docker run -d --name recruitiq-pg -e POSTGRES_PASSWORD=recruitiq -e POSTGRES_DB=recruitiq -p 5432:5432 postgres:16-alpine
```

Or use a hosted provider directly (this project runs on **Neon** — see `.env.example` for its pooled
connection string format).

## Common commands

```bash
npx prisma generate        # regenerate client after schema changes (also runs on `npm install`)
npx prisma migrate dev      # create + apply a migration locally
npx prisma migrate deploy   # apply migrations in production — run manually/in CI, never from Vercel's build
npx prisma studio           # browse the database
npm run db:seed             # seed demo data (see below) — dev/demo only, never run against a live prod DB
npm run build                # production frontend build
npm run preview              # preview that build locally
```

## Demo / seed data

`npm run db:seed` creates a demo company (**Ravantra Technologies**), one open job (**React.js
Developer**), and 10 realistic candidates with resumes — including two candidates intentionally stronger
than a mid-level one, across varied educational backgrounds. Deterministic and offline (no AI calls, no
API key needed to seed) — the real screening only happens when you click **Run AI Screening** in the UI.
Safe to re-run; it deletes and recreates the same demo accounts (all sharing password `Demo@1234`) by
email each time.

## Deploying to Vercel

1. Import the repo as a new Vercel project. `vercel.json` sets the build command, output dir, and two
   rewrites: `/api/*` → the serverless function, everything else → `index.html` (for client-side routing;
   real static assets are still matched and served directly first).
2. Set env vars in the Vercel dashboard: `DATABASE_URL` (pooled), `JWT_SECRET`, `OPENROUTER_API_KEY`,
   `OPENROUTER_MODEL`. `CLIENT_URL`/`OPENROUTER_SITE_URL` can stay unset — they fall back to the
   deployment's own URL automatically.
3. Run `npx prisma migrate deploy` against the production database (locally or in CI) before/after each
   deploy — Vercel's build runs `prisma generate` automatically but never runs migrations.
4. Deploy. `MAX_RESUME_SIZE_MB` defaults to 4 (not 5) because Vercel's Node functions reject request
   bodies above ~4.5MB at the platform level.

## API structure

Versioned under `/api/v1`, one module per resource:

```
/auth          register/login/logout/me (company + candidate)
/companies     company profile
/candidates    candidate profile
/jobs          CRUD + public listing
/resumes       upload + listing
/applications  apply, list, company views, bulk Shortlist/Reject
/screening     run AI screening, ranked/top-10 candidates
/scheduling    interview slots + booking (Phase 2)
```

Every response is `{ success: true, data }` or `{ success: false, message, error }`. Notifications has no
routes of its own — other modules call `email.service.js` directly on status changes.

## Testing

Manual end-to-end scripts hit the real running API (need `OPENROUTER_API_KEY` for AI assertions; degrade
gracefully without it):

```bash
npm run dev:server                                            # in one terminal, then:
node scripts/e2e-test.mjs path/to/resume.docx                  # full Phase 1 acceptance flow
node scripts/test-negative.mjs                                 # invalid file, bad auth, RBAC, etc.
node scripts/test-profile-autofill.mjs path/to/resume.docx      # resume → profile suggestion review
node scripts/test-seed-screening.mjs                            # real ranking over the 10 seeded candidates
node scripts/test-filters-and-bulk.mjs                          # score settings + bulk Shortlist/Reject
node scripts/test-phase2-scheduling.mjs path/to/resume.docx     # emails, booking, reschedule, completion
node scripts/test-race-condition.mjs path/to/resume.docx        # two candidates racing for one slot
node scripts/test-generate-slots.mjs path/to/resume.docx        # AI slot generation (range/duration/buffer math)
```

## Future phases

Not implemented — the architecture is designed so these slot in without restructuring anything above:

- **Phase 2 remainder:** Google Calendar sync, an optional Twilio AI scheduling call. Both would extend
  `scheduling.service.js` rather than needing new endpoints.
- **Phase 3:** AI voice interviews via LiveKit — STT → OpenRouter → TTS → transcript → AI evaluation →
  report. Adds an `interviews` module/route and `InterviewQuestion`/`InterviewAnswer`/`InterviewReport`
  models referencing the `Interview` row already created in Phase 2. The LiveKit voice agent runs as a
  **separate worker service**, not inside this Vercel project — realtime voice doesn't fit a serverless
  function's execution model.
