# RecruitIQ — AI Recruitment Platform (Phase 1)

An AI-powered recruitment platform. Companies post jobs, candidates apply with a resume, and an AI
screening pipeline parses resumes, extracts structured job requirements, and ranks candidates against
each job — combining deterministic rule-based checks with LLM-based semantic matching.

This repository implements **Phase 1 only**. See [Future Phases](#future-phases) for what's deliberately
not built yet, and why the architecture is ready for it.

## Table of contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Folder structure](#folder-structure)
- [Environment variables](#environment-variables)
- [Local setup](#local-setup)
- [PostgreSQL setup](#postgresql-setup)
- [Prisma setup & migrations](#prisma-setup--migrations)
- [Development commands](#development-commands)
- [Production build](#production-build)
- [Vercel deployment](#vercel-deployment)
- [API structure](#api-structure)
- [Testing the acceptance flow](#testing-the-acceptance-flow)
- [Future Phases](#future-phases)

## Architecture

RecruitIQ is a **single Vercel project** containing both the React frontend and the Express API —
there are no separate frontend/backend repositories or deployments.

```
                    Vercel
                      │
          ┌───────────┴───────────┐
          │                       │
       React (Vite)          Express API (api/index.js)
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                 Postgres     OpenRouter     (Brevo — Phase 2)
               (via Prisma)     (AI)

                         Separate later, not part of this Vercel project:
                              │
                           LiveKit
                              │
                        Voice Agent (Phase 3)
```

- In **local development**, `npm run dev` runs a plain Express server (`src/server/dev-server.js`)
  alongside the Vite dev server, with Vite proxying `/api/*` to it.
- In **production on Vercel**, the same Express app (`src/server/app.js`) is exposed through the
  serverless function entry point at `api/index.js`. The frontend is built as static assets and served
  by Vercel; `vercel.json` rewrites `/api/*` to the serverless function.
- The database is any external PostgreSQL provider (Neon, Supabase, Railway, Render, …) — never a
  local file or embedded database.
- AI calls go through OpenRouter and always happen server-side (`src/server/ai/`); the API key is never
  sent to the browser.
- No in-memory application state, no persistent local files, and no long-running processes are used in
  the request path — required for serverless correctness (see [Section 21 notes](#serverless-notes)
  below).

### Serverless notes

- Resume uploads are handled in-memory via `multer` (no disk writes in the request path) and handed to
  a storage driver abstraction (`src/server/resume/storage/`). The default `local` driver writes to
  `./uploads` for **local development convenience only**; production should set `STORAGE_DRIVER=cloud`
  and implement `src/server/resume/storage/cloud.driver.js` against S3/R2/Cloudinary before deploying.
- The Prisma client is cached on `globalThis` (`src/server/config/prisma.js`) so repeated serverless
  invocations reuse one connection pool instead of exhausting the database's connection limit.
- Auth is stateless JWT — no server-side sessions.
- Phase 3's realtime voice agent (LiveKit) is intentionally **not** part of this Express app. Long-lived
  voice sessions don't fit a serverless function's execution model; that will be a separate worker
  service when Phase 3 is built.

## Tech stack

| Layer          | Choice                                             |
| -------------- | --------------------------------------------------- |
| Frontend       | React 18, Vite, Tailwind CSS, Lucide React icons     |
| Backend        | Node.js, Express.js                                  |
| Database       | PostgreSQL, via Prisma ORM                           |
| AI             | OpenRouter (model configurable via env, never hard-coded) |
| Auth           | JWT + bcrypt                                         |
| Resume parsing | `pdf-parse` (PDF), `mammoth` (DOCX)                  |
| Validation     | Zod (shared schemas between client and server)       |

## Folder structure

```
ai-recruitment-platform/
├── src/
│   ├── client/                # React app
│   │   ├── components/        # Reusable UI (Button, Card, StatusBadge, ...)
│   │   ├── pages/              # Route-level pages (company/*, candidate/*, auth/*)
│   │   ├── layouts/            # DashboardLayout + Company/Candidate wrappers
│   │   ├── hooks/               # useAuth (auth context)
│   │   ├── services/            # Thin fetch wrappers per resource
│   │   └── main.jsx
│   │
│   ├── server/                 # Express app
│   │   ├── modules/             # One folder per domain (Section 3)
│   │   │   ├── auth/ users/ companies/ candidates/
│   │   │   ├── jobs/ resumes/ applications/ screening/
│   │   │   └── notifications/ scheduling/ interviews/   # Phase 2/3 stubs — see each README.md
│   │   ├── ai/                  # openrouter.service.js, resume-analyzer, job-analyzer, candidate-matcher
│   │   ├── resume/              # text extraction + storage driver abstraction
│   │   ├── middleware/          # auth, validate, upload, errorHandler
│   │   ├── config/               # env.js, prisma.js
│   │   ├── utils/                 # ApiError, apiResponse, asyncHandler
│   │   └── app.js                  # createApp() — the Express app itself
│   │
│   └── shared/
│       ├── constants/            # roles, statuses — shared between client & server
│       └── schemas/               # Zod schemas — shared between client & server
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── api/
│   └── index.js                  # Vercel serverless entry point (imports src/server/app.js)
│
├── scripts/                       # Manual E2E smoke tests (not part of the app)
├── public/
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
└── README.md
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values you need for local development.

```env
DATABASE_URL=                 # any PostgreSQL connection string
JWT_SECRET=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=             # e.g. openai/gpt-4o-mini — never hard-coded in code
```

Everything else in `.env.example` (Brevo, LiveKit, Deepgram, Twilio) is documented for **future phases**
and is not required for Phase 1 to run. `.env` is gitignored; never commit it.

## Local setup

Prerequisites: Node.js 18+, a PostgreSQL database (local, Docker, or a hosted provider).

```bash
npm install
cp .env.example .env
# edit .env with your DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY, OPENROUTER_MODEL
npx prisma migrate dev
npm run dev
```

This starts the Vite dev server (http://localhost:5173) and the Express API
(http://localhost:3001) concurrently, with Vite proxying `/api/*` to the API.

## PostgreSQL setup

Any PostgreSQL provider works — just set `DATABASE_URL`. For local development without installing
Postgres natively, Docker is the quickest option:

```bash
docker run -d --name recruitiq-pg \
  -e POSTGRES_PASSWORD=recruitiq -e POSTGRES_DB=recruitiq \
  -p 5432:5432 postgres:16-alpine
```

```env
DATABASE_URL="postgresql://postgres:recruitiq@localhost:5432/recruitiq?schema=public"
```

For production, point `DATABASE_URL` at a hosted provider (Neon, Supabase, Railway, Render, etc.) — no
code changes are required.

## Prisma setup & migrations

```bash
npx prisma generate        # regenerate the Prisma client after schema changes (runs automatically
                            # on `npm install` via the `postinstall` script — including on Vercel)
npx prisma migrate dev     # create & apply a migration in development
npx prisma migrate deploy  # apply pending migrations in production — run manually/in CI, never
                            # automatically from the Vercel build step (see Vercel deployment)
npx prisma studio          # browse the database with Prisma's GUI
```

## Demo / seed data

`npm run db:seed` is a **demo/dev data script, not a production task** — it deletes and recreates a
fixed set of demo accounts by email every time it runs. Only run it against a database you're happy to
have that data written into (a fresh production database before real users sign up is fine; a
production database with real users is not).

The seed script (`prisma/seed.js`) creates a demo company, one job, and 10 realistic candidate
profiles/applications for testing the AI screening pipeline end-to-end:

```bash
npm run db:seed
```

This creates **Ravantra Technologies** (demo company) with an open **React.js Developer** job in
Ahmedabad, and 10 candidates who already applied with resumes — including two candidates who are
intentionally a stronger technical match than a mid-level candidate named Ridham Patel, plus a mix of
strong/weak-fit profiles across different educational backgrounds (B.Tech, BCA, Diploma, MBA, etc.).
All demo accounts share the password `Demo@1234` (printed in full, with every email, at the end of the
seed run).

The seed script is intentionally deterministic and makes **no AI calls** — resume text and parsed data
are hand-authored so `npm run db:seed` works offline and produces identical data every run. The actual
AI ranking only happens when you log in as the demo company, open the job's Applications tab, and click
**Run AI Screening** — that's the real screening/matching engine running against real seeded resumes.

Gender is included in the seed data (7 female / 3 male candidates) specifically to verify the AI
screening pipeline ranks candidates purely on job-relevant qualifications — it is deliberately never
sent to the LLM (see the guard rails in `src/server/ai/candidate-matcher.service.js`).

Re-running `npm run db:seed` is safe — it deletes and recreates the demo users first.

## Development commands

```bash
npm install                # install dependencies
npm run dev                # run client + server together (recommended)
npm run dev:client         # Vite dev server only
npm run dev:server         # Express dev server only (node --watch)
npm run db:seed            # seed demo/test data (see above)
```

## Production build

```bash
npm run build               # builds the React app into dist/
npm run preview             # preview the production build locally
```

In production, the API is served through `api/index.js` (see [Vercel deployment](#vercel-deployment))
rather than `src/server/dev-server.js`, which is development-only.

## Vercel deployment

1. Push this repository to GitHub/GitLab/Bitbucket and import it as a new Vercel project.
2. Vercel picks up `vercel.json`, which sets the build command (`npm run build`), the output directory
   (`dist`), and two rewrites:
   - `/api/*` → the serverless function at `api/index.js` (so every `/api/v1/...` route works — Express
     itself does the actual routing once the request reaches the function).
   - everything else → `/index.html`, so client-side routes (`/company/dashboard`, `/candidate/jobs/:id`,
     etc.) work on a hard refresh or direct link instead of 404ing. Real static assets (JS/CSS bundles)
     are matched and served directly first — this rewrite only applies when no built file matches.
3. Set the environment variables below in the Vercel project settings (Project → Settings →
   Environment Variables), not in any committed file:
   - `DATABASE_URL` — **use your provider's pooled connection string.** Every serverless invocation can
     open its own Postgres connection pool, and an unpooled URL exhausts small plans fast under any real
     traffic. Neon, Supabase, and most managed providers expose a pooled URL variant (often via
     PgBouncer) specifically for this. If your pooled URL can't run migrations, run
     `npx prisma migrate deploy` from your machine or CI against the *direct* URL instead — the app
     itself only ever needs the pooled one.
   - `JWT_SECRET` — a long random string. **Required in production** — the app throws on startup rather
     than falling back to an insecure default if this is missing (it only uses a dev fallback when
     `NODE_ENV !== 'production'`).
   - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` — required for the AI features to work; screening/parsing
     degrade gracefully (clear errors, nothing crashes) if omitted, but won't produce real results.
   - `STORAGE_DRIVER` — safe to leave unset; it defaults to `database` (see
     [Resume storage](#resume-storage-driver) below), which works on Vercel with no extra setup.
   - `CLIENT_URL`, `OPENROUTER_SITE_URL` — safe to leave unset in production; both fall back to your
     Vercel deployment URL automatically (via the `VERCEL_URL` env var Vercel injects) rather than
     defaulting to `localhost`.
4. Run `npx prisma migrate deploy` against your production database (from your machine or a CI step)
   before or right after the first deploy, and after any future schema change. Vercel's build step runs
   `prisma generate` automatically via the `postinstall` script, but it never runs migrations —
   applying migrations against a live database from an automated build step is deliberately avoided.
5. Deploy. The same Express app (`src/server/app.js`) that runs locally through
   `src/server/dev-server.js` runs inside the serverless function via `api/index.js` — no code changes
   between environments.

### Resume storage driver

Vercel serverless functions have no persistent, writable local filesystem, so resume uploads can't be
written to disk in production. `STORAGE_DRIVER=database` (the default) stores each resume's raw bytes
in Postgres via a small `ResumeBlob` table — it works with any provider, needs no extra credentials, and
comfortably handles resumes at the app's size limit (`MAX_RESUME_SIZE_MB`, default 4MB). `STORAGE_DRIVER=local`
writes to disk and must only ever be used for local development. `STORAGE_DRIVER=cloud` is a stub
(`src/server/resume/storage/cloud.driver.js`) for a future S3/R2/Cloudinary implementation — swapping to
it means implementing that one file; nothing in `resumes.service.js` needs to change, since every driver
implements the same `save()`/`read()` interface (`src/server/resume/storage/index.js`).

`MAX_RESUME_SIZE_MB` defaults to 4MB rather than a rounder number like 5 because Vercel's Node.js
serverless functions reject request bodies above roughly 4.5MB at the platform level, before Express
(and multer's own size-limit check) ever sees the request — raising this above that ceiling wouldn't
actually allow bigger uploads in production, it would just make the failure less clear.

## API structure

All endpoints are versioned under `/api/v1`:

```
/api/v1/auth            register/login/logout/me (company + candidate)
/api/v1/companies        company profile
/api/v1/candidates        candidate profile
/api/v1/jobs               job CRUD + public listing
/api/v1/resumes            resume upload + listing
/api/v1/applications       apply, list, company views
/api/v1/screening          run AI screening, ranked/top-10 candidates
```

Every response follows one of two shapes:

```json
{ "success": true, "data": { } }
{ "success": false, "message": "…", "error": "ERROR_CODE" }
```

Future (Phase 2/3), mounted the same way without touching Phase 1 routes:

```
/api/v1/notifications
/api/v1/scheduling
/api/v1/interviews
/api/v1/reports
```

## Screening decisions: settings, filters, and bulk actions

Each job has two decision settings (`Job.minAcceptableScore`, `Job.autoRejectBelowMinScore`, editable
from the job's Applications page):

- **Screening never auto-shortlists.** A screened application's resting status is `SCREENING`
  (scored, awaiting a decision) regardless of how high its score is.
- **Auto-reject is opt-in.** When `autoRejectBelowMinScore` is enabled, screening automatically marks
  anything scoring below `minAcceptableScore` as `REJECTED`. When disabled (the default), every screened
  application — high or low score — stays `SCREENING` until the company acts on it.
- The company moves candidates to `SHORTLISTED`/`REJECTED` manually, including in bulk, via
  `PATCH /api/v1/applications/job/:jobId/bulk-status` (checkbox selection + "Shortlist selected" /
  "Reject selected" in the UI).
- The Applications page's filters (AI score range, experience, skills, education, status, sort) run
  entirely client-side over the already-fetched application list — there's no separate filtered-query
  endpoint, since a single job's applicant list is small enough that this is simpler and just as fast.
- As always, none of this reads gender or other demographic data — see the guard rails documented in
  `src/server/ai/candidate-matcher.service.js`.

## Testing the acceptance flow

Manual smoke-test scripts exercise the full Phase 1 flow described in the project brief (company
registers → creates a job → candidate registers → applies with a resume → AI screening → ranked
candidates → candidate detail) directly against the running API:

```bash
npm run dev:server   # in one terminal

# in another terminal, with a real PDF or DOCX resume file:
node scripts/e2e-test.mjs path/to/resume.docx

# negative-path checks (invalid file type, wrong password, RBAC, etc.):
node scripts/test-negative.mjs

# resume-upload profile auto-fill review flow (Section 6/7), with a resume file
# that mentions a university/degree/SPI:
node scripts/test-profile-autofill.mjs path/to/resume.docx

# run real AI screening against the 10 seeded candidates and print the ranking
# (run `npm run db:seed` first):
node scripts/test-seed-screening.mjs

# job screening-decision settings + bulk Shortlist/Reject (run `npm run db:seed` first):
node scripts/test-filters-and-bulk.mjs
```

All of these require `OPENROUTER_API_KEY` to be set for the AI-dependent assertions to pass; if it's
missing, AI calls fail gracefully (jobs/resumes/applications still save; screening is marked `FAILED`
with a clear error) rather than blocking the rest of the flow.

## Future Phases

Phase 1 intentionally does not implement the following. The schema, module layout, and API versioning
are designed so they can be added without restructuring what's already here.

### Phase 2

```
Shortlisted Candidate
        ↓
Brevo
        ↓
Candidate Email
        ↓
Scheduling
        ↓
Calendar

Optional: Twilio → AI scheduling call
```

Adds: `notifications` and `scheduling` modules, `Notification`/`EmailLog`/`InterviewSchedule`/`CallLog`
Prisma models, and new `ApplicationStatus` values appended (never repurposed) to the Phase 1 enum.

### Phase 3

```
Scheduled Interview
        ↓
LiveKit
        ↓
Voice Agent
        ↓
STT
        ↓
OpenRouter
        ↓
TTS
        ↓
Transcript
        ↓
AI Evaluation
        ↓
Interview Report
```

Adds: an `interviews` module and `Interview`/`InterviewQuestion`/`InterviewAnswer`/`InterviewReport`
Prisma models, plus an `/interview/:id` frontend route. The LiveKit voice agent itself runs as a
**separate worker service**, not inside this Vercel project's serverless functions — see
[Serverless notes](#serverless-notes).
