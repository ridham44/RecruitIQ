# RecruitIQ — AI Recruitment Platform

An AI-powered recruitment platform for recruitment agencies. An agency posts jobs (optionally on behalf of
a client company), candidates apply with a resume — logged in, or as a guest through a public careers
portal — and an AI pipeline parses resumes, extracts structured job requirements, and scores/ranks
candidates against each job. Shortlisted candidates take a fully automated AI voice interview (booked from
slots, or via an instant "attend now or later" link), get a final score, and qualified candidates are
submitted to the company's HR person, who reviews them in a read-only link or their own portal.

**Naming:** the UI, emails and messages say **Portal Admin**, **Agency** (the recruitment company, its
owner and agency recruiters), **Company** (the agency's client) and **Company HR**. Code identifiers,
routes, enums and permission keys keep the older names — e.g. the agency is `Company` / role `COMPANY`,
the client company is `ClientCompany` (`/clients`), and Company HR is `HiringPerson` / role `CLIENT_HR`.

Want to see every role quickly? Run `node scripts/seed-demo.mjs` and open `/live-demo` — see
[Live demo page](#live-demo-page).

## What it does

**Portal Admin:** onboards agencies (invite link to set the owner's password), suspends/activates
agencies, manages users.

**Agency (owner + agency recruiters):** post a job (AI extracts structured requirements) → link it to a
company and its Company HR (department optional) → review applicants → run AI screening → filter/sort by
score, experience, skills, education, status → shortlist or reject (in bulk, or automatically on the
score) → AI interview via booked slots or an instant link → final score (CV + interview) → submit
qualified candidates to the company. Owners invite recruiters with granular permissions and job/company
assignments.

**Candidate:** register (or apply as a guest with phone OTP) → build a profile (resume upload auto-fills
academic fields, reviewed before saving) → apply → track status → book an interview slot or open an
interview link → take the AI voice interview. Candidates **without a login** get a personal status link
in every email: it shows a progress timeline and lets them book, change and join their slot interview
(see [Notifications & interview scheduling](#notifications--interview-scheduling-phase-2)).

**Company HR:** receives submitted candidate packages by email (private read-only link), or logs into the
client portal to see every candidate submitted to them (scores, interview summary and CV, view only).

**Screening engine:** deterministic checks (skill overlap, experience range, education match) blended
with an LLM's semantic read of the resume — the LLM is never the sole source of truth, and gender/name/
other demographic data is never sent to it (see [AI & screening](#ai--screening)).

## Roles

| Role (code)   | Shown as         | Who                                               | Lands on               |
| ------------- | ---------------- | ------------------------------------------------- | ---------------------- |
| `ADMIN`       | Portal Admin     | Created by script only                            | `/admin/companies`     |
| `COMPANY`     | Agency owner     | Owns the agency — every permission                | `/company/dashboard`   |
| `RECRUITER`   | Agency recruiter | Invited by the owner — permissions + assigned jobs/companies only | `/company/dashboard` |
| `CANDIDATE`   | Candidate        | Job seeker (registered or guest)                  | `/candidate/dashboard` |
| `CLIENT_HR`   | Company HR       | HR / hiring person at the agency's client company | `/client/candidates`   |

Recruiter permissions (`src/shared/constants/permissions.js`): `MANAGE_JOBS`, `REVIEW_CANDIDATES`,
`CONFIGURE_INTERVIEWS`, `MANAGE_RECRUITERS`, `MANAGE_CLIENTS`, `SUBMIT_CANDIDATES`. New recruiters get
`REVIEW_CANDIDATES` + `CONFIGURE_INTERVIEWS` by default. Recruiters only see jobs assigned to them, jobs
they created, and jobs of companies assigned to them (`403 JOB_NOT_ASSIGNED` otherwise).

Company HR belong directly to a company (the company page has a **Company HR** tab); the department is an
optional label. On a job, Company HR is picked by company.

## Application pipeline

```
APPLIED → SCREENING → SHORTLISTED ─┬→ INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED → QUALIFIED → SUBMITTED_TO_CLIENT
                     └→ REJECTED   └→ (instant link)                            └→ NOT_QUALIFIED
```

`QUALIFIED` / `NOT_QUALIFIED` only happen when the job has a final threshold. Candidates never see the
final score or the post-interview statuses — they see `INTERVIEW_COMPLETED`.

## Tech stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | React 18, Vite, Tailwind CSS (mobile-first), Lucide icons         |
| Backend    | Node.js, Express (same app runs as a Vercel serverless function)  |
| Database   | PostgreSQL via Prisma ORM (any provider; built/tested on Neon)    |
| AI         | OpenRouter — model set entirely by env var, never hard-coded      |
| Auth       | JWT (Bearer token) + bcrypt — stateless, no cookies/sessions      |
| Email      | Brevo transactional API, with a console-log fallback when unset   |
| SMS (OTP)  | Console driver by default, Twilio optional                        |
| Voice      | LiveKit (room/transport) + Deepgram (STT + TTS) — separate worker |
| Validation | Zod schemas shared between client and server                      |

## Architecture

One Vercel project serves both the frontend and the API — no separate deployments.

```
Vercel
  ├── React (Vite) ── static build in dist/
  └── Express API (api/index.js) ── same app.js used by local dev
        ├── Postgres (Prisma)
        ├── OpenRouter (AI)
        ├── Brevo (email) / Twilio (SMS OTP, optional)
        └── LiveKit (token generation only — never joins a room)

Not part of this Vercel project — a separate long-running process:
  livekit-worker/ ── joins the LiveKit room, runs STT/TTS, calls back into
                     the Vercel API above for every interview decision
```

- Local dev: Vite dev server + a plain Express server (`src/server/dev-server.js`), Vite proxies `/api/*`.
- Production: `vercel.json` rewrites `/api/*` to `api/index.js` (the same Express app) and falls back to
  `index.html` for client-side routes.
- Resumes are stored as bytes in Postgres by default (`STORAGE_DRIVER=database`) — Vercel functions have
  no persistent filesystem, so this is what makes uploads work there with zero extra setup. Swappable to
  S3/R2/Cloudinary later via `src/server/resume/storage/cloud.driver.js` — nothing else changes.
- No in-memory state, no background workers, no long-lived connections in the Vercel app — every request
  is self-contained. The one long-lived process, `livekit-worker/`, is kept entirely outside it.
- Company-side lookups go through `src/server/modules/companies/companyContext.js` (membership first,
  owner fallback) and `middleware/permission.js` (`requirePermission`, skipped for owners).

## Folder structure

```
src/
├── client/              React app
│   ├── pages/            admin/, auth/, candidate/, careers/ (public), client/ (HR portal), company/
│   ├── layouts/          Admin, Company, Dashboard (candidate), ClientPortal
│   ├── components/       shared UI (ui/), SubmissionPackage, ProtectedRoute
│   ├── services/         fetch wrappers, one per API module
│   └── hooks/            useAuth, usePermissions
├── server/
│   ├── modules/          One folder per domain: auth, admin, config, companies, recruiters, clients,
│   │                      candidates, education, jobs, resumes, applications, screening, scheduling,
│   │                      interviews, submissions, clientPortal, public, cvPool, notifications
│   │                      Each: routes.js → controller.js → service.js → Prisma
│   ├── ai/               openrouter.service.js + resume/job/candidate/interview analyzers
│   ├── resume/storage/   swappable storage driver (database / local / cloud)
│   ├── middleware/       auth, permission, workerAuth, validate, upload, errorHandler
│   └── config/           env.js (incl. feature flags), prisma.js
└── shared/               constants (roles, permissions, statuses) + Zod schemas used by client and server
prisma/                   schema.prisma, migrations/, seed.js, seed-demo-interviews.js
api/index.js              Vercel serverless entry point (imports server/app.js)
livekit-worker/           separate Node process — the AI interview voice agent (its own package.json)
scripts/                  admin, backup/restore and end-to-end test scripts (see below)
tests/unit/               node:test unit tests
```

## AI & screening

- `src/server/ai/` — one file per concern: `openrouter.service.js` (the only place that calls
  OpenRouter), `resume-analyzer`, `job-analyzer`, `candidate-matcher`. The API key never reaches the
  browser.
- Matching combines deterministic scoring (`screening/deterministic.util.js`) with the LLM's semantic
  read, weighted together — never the LLM alone.
- **Gender/name are never sent to the LLM.** The candidate-matcher only picks specific job-relevant
  fields into the prompt (never spreads a full object), and additionally scrubs demographic lines and
  the candidate's name out of any raw resume text — defense in depth, not just a prompt instruction.
- Per job, a company sets `minAcceptableScore` and `autoRejectBelowMinScore`. By default screening
  **never auto-shortlists** — a screened application rests at `SCREENING`. A job can opt into
  `autoAdvanceOnMatch`, which shortlists/rejects on the score and emails the candidate.
- Screening (including forced re-runs) never overwrites post-interview statuses.
- The Applications page's filters run client-side over the already-fetched list.

## Notifications & interview scheduling (Phase 2)

- An application becoming `SHORTLISTED` or `REJECTED` triggers an email via
  `src/server/modules/notifications/email.service.js`. Driver is `brevo` when `BREVO_API_KEY` is set,
  else `console` (logs instead of sending). Every attempt is logged to `EmailLog`.
- A company creates `InterviewSlot`s for a job — one at a time, or via **Create AI Interview Slots**
  (time range + duration + optional buffer, e.g. 10:00–13:00 at 15 minutes → 12 slots, skipping
  overlaps). Booking is an atomic conditional update (`AVAILABLE` → `BOOKED`), so two candidates racing
  for one slot can't both win — the loser gets a clean `409`. Booking moves the application to
  `INTERVIEW_SCHEDULED` and emails a confirmation.
- Cancelling frees the slot and reverts the application to `SHORTLISTED` — that's "Reschedule".
- **No login needed.** Every candidate email carries the candidate's personal status link
  (`/careers/track`). The status page shows a progress timeline, and on a slot-based job the candidate can
  book, change and join their interview from it — with the same atomic, no-double-booking rule. Manually
  shortlisting a candidate on an instant-link job emails the interview link. Logged-in flows are
  unchanged.

## AI voice interviews (Phase 3)

- **Configuration.** Per job: the AI interviewer's name/title, question count, per-question timer, and
  custom questions asked verbatim (`AiInterviewConfig`, on the job's Interviews page). Recruiters can also
  add interview instructions, evaluation criteria and must-cover skills (see P6 below).
- **A controlled state machine, not a free-roaming LLM.** A fixed stage order (`INTRODUCTION →
  RESUME_QUESTIONS → BASIC_TECHNICAL → JOB_SPECIFIC → SCENARIO → BEHAVIORAL → CANDIDATE_QUESTIONS → END`)
  and a deterministic per-stage budget live in `interviewEngine.service.js`. The LLM only chooses question
  wording and whether one follow-up is warranted — never the stage order, count, or when it ends.
- **Adaptive difficulty** follows a fixed rule table (`interviewDifficulty.util.js`): the job's minimum
  experience sets the seniority tier, and each answer's strength moves the next question's difficulty.
- **Transcript normalization** (`transcript-normalizer.service.js`): deterministic filler/stutter cleanup
  plus a guarded LLM correction that is rejected if it diverges too far. The raw transcript is always
  kept; recruiters can manually correct a transcription.
- **Closing questions.** On the final "any questions for us?" turn the AI gives a short spoken reply
  grounded only in the job description and company info (never promises outcome or salary), then ends.
- **Realtime voice runs in a separate process.** The browser joins a LiveKit room with a server-generated
  token (`LIVEKIT_API_SECRET` never reaches the frontend). `livekit-worker/` joins the same room, streams
  audio to Deepgram STT, and POSTs each finished answer to `/interviews/:id/worker/answer` (shared-secret
  auth). This app decides the next step; the worker speaks it via Deepgram TTS. See
  `livekit-worker/README.md`.
- **Camera is on for presence, never recorded.** Only the transcript and monitoring events (`CAMERA_OFF`,
  `TAB_SWITCH`, `CONNECTION_LOST`, …) are stored — no video/audio, and nothing is used for facial/emotion
  scoring.
- **Two evaluation passes:** a lightweight per-answer check (follow up or move on, budget-capped) and a
  full report after the interview (`interview-report-generator.service.js`), blended with a deterministic
  skill-overlap check into `InterviewReport`.

## Build plan P0–P8

Shipped on top of Phases 1–3. Each phase is additive; the gated ones are off until their feature flag is
turned on.

| Phase | Feature | Flag |
| ----- | ------- | ---- |
| P0 | Safety net: feature flags, `npm run test:smoke`, DB backup/restore scripts | — |
| P1 | Portal Admin, admin-only agency onboarding, invite/set-password links, suspend/activate | `ALLOW_COMPANY_SELF_REGISTER` |
| P2 | Agency recruiters with permissions and job assignments (`/company/recruiters`) | — |
| P3 | Client companies and their Company HR (department optional), linked to jobs; company-recruiter assignment | — |
| P4 | Public careers portal (`/careers/:slug`), guest apply with phone OTP, CV-only submission with best-job auto matching, CV pool | `FEATURE_GUEST_APPLY` |
| —  | Forgot password (1-hour reset link, rate-limited) | — |
| P5 | Instant interview link (`/interview/:token`, attend now or later) instead of slot booking, chosen per job | `FEATURE_INSTANT_INTERVIEW` |
| P6 | Recruiter interview & evaluation instructions; per-criterion `MET` / `PARTLY` / `NOT_MET` verdicts on the report | — |
| P7 | Final score (CV × weight + interview × weight), final threshold, submission to client with a private read-only link | — |
| P8 | Company HR portal (`/client/candidates`) — Company HR see only candidates submitted to them | `FEATURE_CLIENT_PORTAL` |
| —  | Company HR under the company, new display names, live demo page, booking from the status link | `DEMO_PAGE` (demo page only) |

Notes:

- **Tokens:** invite, reset, interview-link and submission tokens are single-use or revocable, and only
  their hashes are stored. OTP and tracking tokens can't be used as login sessions. Interview-link
  sessions are scoped to their own interview's routes (`401 INTERVIEW_SCOPE` elsewhere).
- **OTP limits:** 6 digits, 5-minute expiry, 5 attempts, 3 per 15 min per phone, 10 per hour per IP,
  30 s resend.
- **Recruiter guidance (P6)** is sanitized — any sentence mentioning protected characteristics is dropped
  before it reaches a prompt — and empty guidance produces byte-identical prompts (unit-tested).
- **Final score (P7)** is recalculated after every completed report and can be recalculated per
  application or per job; a job can auto-submit qualified candidates to its Company HR.

## Environment variables

Copy `.env.example` to `.env`. Minimum to run locally:

```env
DATABASE_URL=          # any Postgres provider — use the POOLED string in production
JWT_SECRET=            # required in production; the app refuses to start without it there
OPENROUTER_API_KEY=
OPENROUTER_MODEL=      # e.g. openai/gpt-4o-mini — never hard-coded in code
```

Everything else has a safe default — see the comments in `.env.example`:

| Group | Variables |
| ----- | --------- |
| Server / storage | `PORT`, `CLIENT_URL`, `STORAGE_DRIVER`, `UPLOAD_DIR`, `MAX_RESUME_SIZE_MB` |
| Email | `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`, `EMAIL_PROVIDER` |
| AI voice interviews | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `INTERVIEW_WORKER_SECRET`, `DEEPGRAM_API_KEY` |
| SMS OTP | `SMS_DRIVER` (`console` / `twilio`), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `DEFAULT_PHONE_COUNTRY_CODE` (`+91`) |
| Feature flags | `ALLOW_COMPANY_SELF_REGISTER` (default `true`), `FEATURE_GUEST_APPLY`, `FEATURE_INSTANT_INTERVIEW`, `FEATURE_CLIENT_PORTAL` (default `false`) |
| Demo page | `DEMO_PAGE` (default `false`), `DEMO_PASSWORD` (default `Demo@123`) |

Feature flags accept `true`/`false` (also `1`/`0`, `yes`/`no`, `on`/`off`). Set
`ALLOW_COMPANY_SELF_REGISTER=false` once a Portal Admin exists — agencies can then only be onboarded by
the admin. With `SMS_DRIVER=console`, OTP codes print in the API server's terminal.

To run AI voice interviews you also need the `LIVEKIT_*` values, `INTERVIEW_WORKER_SECRET` (any long
random string, matched in `livekit-worker/.env`), and `livekit-worker/` running separately.

## Live demo page

`/live-demo` (`/start` redirects to it, and the landing page links to it) lists every role with what it
can do, plus the public links: the demo agency's careers page, CV-only submission, application tracking
and registration. It works off fixed demo accounts on the
non-routable `@recruitiq.demo` domain (`src/shared/constants/demo.js`), so no real inbox ever gets their
emails:

| Account | Email |
| ------- | ----- |
| Portal Admin | `admin@recruitiq.demo` |
| Agency owner | `agency@recruitiq.demo` |
| Agency recruiter | `recruiter@recruitiq.demo` |
| Company HR | `hr@recruitiq.demo` |
| Candidate | `candidate@recruitiq.demo` |

```bash
node scripts/backup-db.mjs before-demo   # it writes to DATABASE_URL — back up first
node scripts/seed-demo.mjs               # create the demo set (skips if it already exists)
node scripts/seed-demo.mjs --reset       # delete the demo set first, then recreate it
```

The seed goes through the app's real flows on its own API instance (port 3093, needed features on, console
email): **Demo Talent Agency** with its careers link, **Demo Software Pvt Ltd** with an Engineering
department and its Company HR, an agency recruiter, the open job **Frontend Developer (Demo)**, a candidate
with a profile and CV who hasn't applied yet (so you can apply live), and one sample candidate already
submitted to Company HR.

The demo emails and password are only shown on the page while `DEMO_PAGE=true`. With it off, the page still
lists the roles and links. All demo accounts share `DEMO_PASSWORD`. `DEMO_PAGE=true` publishes working
demo logins to anyone who opens the page, so only turn it on where that's intended (it never exposes real
accounts).

## Local setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY, OPENROUTER_MODEL
npx prisma migrate dev      # fresh/local database only — see "Database notes" for the shared Neon DB
node scripts/create-admin.mjs --email admin@example.com --password "Secret123"
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
npm run dev                  # client + API together
npx prisma generate          # regenerate client after schema changes (also runs on `npm install`)
npx prisma migrate status    # check which migrations are applied
npx prisma migrate deploy    # apply pending migrations (shared/production DBs)
npx prisma studio            # browse the database
npm run db:seed              # demo company/job/candidates — dev/demo only, never on a live prod DB
npm run db:seed:demo-interviews  # 3 completed demo AI interviews on top of db:seed
node scripts/seed-demo.mjs   # live demo page accounts (see "Live demo page"), --reset to recreate
npm run build                # prisma generate + production frontend build
npm run preview              # preview that build locally
npm run test:unit            # unit tests
npm run test:smoke           # full API happy path against the running server
```

Admin and database scripts:

```bash
node scripts/create-admin.mjs --email <email> --password <password> [--reset-password]
node scripts/backup-db.mjs [label]                     # read-only: schema.sql + data.json into backups/ (git-ignored)
node scripts/restore-db.mjs backups/<folder> [--data-only]  # onto a NEW, EMPTY DB from RESTORE_DATABASE_URL only
```

## Database notes

- **Back up before a migration** on the shared database: `node scripts/backup-db.mjs before-<change>`.
- **Use `prisma migrate deploy`, not `migrate dev`, on the shared Neon database.** The live database still
  has columns and enums from the reverted telephonic-interview feature (`interviews.mode`, `callStatus`,
  `phoneNumber`, `twilioCallSid`, `callAttempts`, `interview_slots.mode`, the `CallStatus` /
  `InterviewMode` enums, …) that `schema.prisma` no longer has. The P1–P8 and later migrations were hand-written to
  leave them untouched. `migrate dev` sees this as drift and may offer to **reset the database — never
  accept that** on the shared DB. Removing those columns needs a deliberate, reviewed migration.
- Interactive transactions use `TX_OPTIONS` (15 s wait / 30 s timeout) — Prisma's 5 s default failed
  against a slow remote Neon connection.

## Demo / seed data

`npm run db:seed` creates a demo company (**Ravantra Technologies**), one open job (**React.js
Developer**), and 10 realistic candidates with resumes, across varied backgrounds. Deterministic and
offline (no AI calls) — real screening only happens when you click **Run AI Screening**. Safe to re-run;
it recreates the same demo accounts (all sharing password `Demo@1234`) each time.
`npm run db:seed:demo-interviews` then adds 3 completed AI interviews at different performance tiers
(marked `aiModel: 'demo-seed-data'`).

## Deploying to Vercel

1. Import the repo as a new Vercel project. `vercel.json` sets the build command, output dir, and the
   `/api/*` → serverless function and SPA fallback rewrites.
2. Set env vars in the Vercel dashboard: `DATABASE_URL` (pooled), `JWT_SECRET`, `OPENROUTER_API_KEY`,
   `OPENROUTER_MODEL`, plus any email/SMS/voice values and feature flags you use. `CLIENT_URL` /
   `OPENROUTER_SITE_URL` can stay unset — they fall back to the deployment's own URL.
3. Run `npx prisma migrate deploy` against the production database (locally or in CI) — Vercel's build runs
   `prisma generate` but never runs migrations.
4. Create the Portal Admin with `scripts/create-admin.mjs` against the production database.
5. `MAX_RESUME_SIZE_MB` defaults to 4 because Vercel's Node functions reject bodies above ~4.5 MB.
6. For AI voice interviews, also set the `LIVEKIT_*` values and `INTERVIEW_WORKER_SECRET`, and deploy
   `livekit-worker/` separately — see `livekit-worker/README.md`.

## API structure

Versioned under `/api/v1`, one module per resource:

```
/auth                   register/login/logout/me, set-password, forgot-password
/admin                  companies + users (ADMIN only)
/config                 public config (e.g. whether company self-signup is allowed)
/companies              company profile
/recruiters             invite, permissions, job assignments (company side)
/clients                client companies, their Company HR, departments, recruiter assignment
/candidates             candidate profile; /candidates/me/education
/jobs                   CRUD + public listing; /jobs/:id/client-link (company side only)
/resumes                upload + listing
/applications           apply, list, company views, bulk Shortlist/Reject
/screening              AI screening, ranked/top candidates, best-job matching
/scheduling             interview slots + booking; instant-interview links
/interviews             AI interviewer config, LiveKit tokens, state machine, transcript/report
/submissions            final score, submit to client, history
/client-portal          CLIENT_HR only — candidates submitted to that Company HR
/cv-pool                CV-only submissions and manual placement
/public                 careers portal, OTP, guest apply, tracking   (FEATURE_GUEST_APPLY)
/public/interviews      instant interview link                       (FEATURE_INSTANT_INTERVIEW)
/public/submissions     Company HR's read-only candidate link        (always on)
```

Every response is `{ success: true, data }` or `{ success: false, message, error }`. Notifications has no
routes of its own — other modules call `email.service.js` / the SMS driver directly. `/interviews` also
has a `/worker/*` set authenticated by a shared secret (the livekit-worker has no user credentials).

## Testing

```bash
npm run test:unit            # node:test unit tests in tests/unit/ — no server or API key needed
```

The scripts below hit the real running API (`npm run dev:server` in another terminal). They need
`OPENROUTER_API_KEY` for AI assertions and degrade gracefully without it. Run them against a dev
database — they create test data.

```bash
npm run test:smoke                                              # full current happy path (P0)
node scripts/e2e-test.mjs path/to/resume.docx                   # Phase 1 acceptance flow
node scripts/test-negative.mjs                                  # invalid file, bad auth, RBAC, etc.
node scripts/test-profile-autofill.mjs path/to/resume.docx      # resume → profile suggestion review
node scripts/test-seed-screening.mjs                            # ranking over the 10 seeded candidates
node scripts/test-rerun-screening.mjs                           # force re-run screening (non-destructive)
node scripts/test-filters-and-bulk.mjs                          # score settings + bulk Shortlist/Reject
node scripts/test-phase2-scheduling.mjs path/to/resume.docx     # emails, booking, reschedule, completion
node scripts/test-race-condition.mjs path/to/resume.docx        # two candidates racing for one slot
node scripts/test-generate-slots.mjs path/to/resume.docx        # AI slot generation math
node scripts/test-phase3-interview.mjs path/to/resume.docx      # full AI interview engine, report, RBAC
node scripts/test-phase3-difficulty-adaptation.mjs              # adaptive difficulty rule table
node scripts/test-phase3-manual-correction.mjs                  # manual transcript correction
node scripts/test-forgot-password.mjs                           # password reset flow
node scripts/test-p1-platform-admin.mjs                         # P1 … P8: one script per build-plan phase
node scripts/test-p2-recruiters.mjs
node scripts/test-p3-clients.mjs
node scripts/test-p4-careers-portal.mjs
node scripts/test-p5-instant-interview.mjs
node scripts/test-p6-recruiter-instructions.mjs
node scripts/test-p7-final-score-submission.mjs
node scripts/test-p8-client-portal.mjs
node scripts/test-track-booking.mjs                             # no-login status link: timeline, book/change/join a slot
```

The P4, P5, P8 and track-booking scripts start their own API instance with the features they need turned
on, so they work even when the dev server has those flags off.

The interview scripts drive the engine by posting simulated transcripts to the same `/worker/answer`
endpoint the real livekit-worker calls. They cover everything except the realtime audio path, which
needs a browser and microphone — see `livekit-worker/README.md`.

## Not implemented

- Google Calendar sync for interview slots.
- Phone (telephonic) AI interviews — built on the `jayashri` branch, then reverted on `main`
  (see [Database notes](#database-notes)).
- Video recording — deliberately never implemented, by design.
- Swapping Deepgram for another STT/TTS provider means changing `livekit-worker/src/deepgram.js` only.
