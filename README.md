# RecruitIQ — AI Recruitment Platform

An AI-powered recruitment platform. Companies post jobs, candidates apply with a resume, and an AI
pipeline parses resumes, extracts structured job requirements, and scores/ranks candidates against each
job. Once shortlisted, candidates are emailed and book their own interview from company-published slots
— including a fully automated AI voice interview conducted inside the app over LiveKit.

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
        ├── Brevo (email)
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
  is self-contained. The one long-lived process in this system, `livekit-worker/`, is intentionally kept
  entirely outside it — see [AI voice interviews](#ai-voice-interviews-phase-3).

## Folder structure

```
src/
├── client/            React app — pages/, components/, layouts/, services/ (fetch wrappers), hooks/
├── server/
│   ├── modules/        One folder per domain: auth, companies, candidates, jobs, resumes,
│   │                    applications, screening, scheduling, notifications, interviews
│   │                    Each: routes.js → controller.js → service.js → Prisma
│   ├── ai/              openrouter.service.js + resume/job/candidate/interview analyzers
│   ├── resume/storage/  swappable storage driver (database / local / cloud)
│   ├── middleware/       auth, workerAuth, validate, upload, errorHandler
│   └── config/            env.js, prisma.js
└── shared/              constants + Zod schemas used by both client and server
prisma/                 schema.prisma, migrations/, seed.js
api/index.js            Vercel serverless entry point (imports server/app.js)
livekit-worker/         separate Node process — the AI interview voice agent (its own package.json)
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

## AI voice interviews (Phase 3)

An "AI interview slot" is just a normal Phase 2 `InterviewSlot` — nothing about slot creation or booking
changed. What's new is what happens once a candidate joins one.

- **Configuration.** Per job, a company sets the AI interviewer's name/title (e.g. "Priya – Virtual HR"),
  how many questions to ask, the per-question answer timer, and custom questions the AI must ask
  verbatim (`AiInterviewConfig`, editable from the job's Interviews page).
- **The interview is a controlled state machine, not a free-roaming LLM.** A fixed stage order
  (`INTRODUCTION → RESUME_QUESTIONS → BASIC_TECHNICAL → JOB_SPECIFIC → SCENARIO → BEHAVIORAL →
  CANDIDATE_QUESTIONS → END`) and a deterministic per-stage question budget live in
  `interviewEngine.service.js`. The LLM only ever chooses question wording (from the job description,
  the candidate's resume, and prior answers) and whether one follow-up is warranted — never the stage
  order, the question count, or when the interview ends.
- **Realtime voice runs in a separate process.** The candidate's browser joins a LiveKit room using a
  token this app generates server-side (`LIVEKIT_API_SECRET` never reaches the frontend); `livekit-worker/`
  — a standalone Node process, not part of this Vercel project — joins the same room, streams the
  candidate's audio to Deepgram STT, and once Deepgram detects they've finished speaking, POSTs the
  transcript to this app's `/interviews/:id/worker/answer` (authenticated by a shared secret, since the
  worker has no user JWT). This app decides the next question or ends the interview; the worker speaks
  the response via Deepgram TTS and republishes it into the room. See `livekit-worker/README.md`.
- **Camera is on for presence, never recorded.** Only a transcript and discrete monitoring events
  (`CAMERA_OFF`, `MIC_OFF`, `TAB_SWITCH`, `PAGE_LEFT`, `FULLSCREEN_EXIT`, `CONNECTION_LOST`, etc.) are
  stored (`InterviewEvent`) — no video/audio is ever written to storage, and none of this is used for
  facial/emotion/lie-detection scoring.
- **Two evaluation passes**, same discipline as screening: a lightweight per-answer check
  (`interview-answer-evaluator.service.js`) decides only "follow up or move on", capped by a deterministic
  budget so the LLM can't turn the interview into an unbounded back-and-forth. A deeper evaluation runs
  once after the interview ends (`interview-report-generator.service.js`), blended with a deterministic,
  non-LLM resume/job skill-overlap check (reused from the screening module) into `InterviewReport`.

## Environment variables

Copy `.env.example` to `.env`. Minimum to run locally:

```env
DATABASE_URL=          # any Postgres provider — use the POOLED string in production
JWT_SECRET=             # required in production; app refuses to start without it there
OPENROUTER_API_KEY=
OPENROUTER_MODEL=       # e.g. openai/gpt-4o-mini — never hard-coded in code
```

Everything else (`STORAGE_DRIVER`, `BREVO_*`, `CLIENT_URL`, `LIVEKIT_*`, `INTERVIEW_WORKER_SECRET`, and
the Phase-3-remainder Twilio placeholders) has a safe default or is optional to run the core app — see
the comments in `.env.example`. To actually run AI voice interviews you also need `LIVEKIT_URL` /
`LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`, `INTERVIEW_WORKER_SECRET` (any long random string, matched in
`livekit-worker/.env`), and to start `livekit-worker/` separately — see
[AI voice interviews](#ai-voice-interviews-phase-3) and `livekit-worker/README.md`.

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
5. For AI voice interviews, also set `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` and
   `INTERVIEW_WORKER_SECRET` in the Vercel dashboard, and deploy `livekit-worker/` separately — see
   `livekit-worker/README.md`. Everything else (screening, scheduling, notifications) works without it;
   the app just won't be able to run an AI interview until the worker is deployed and its webhook is
   configured.

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
/interviews    AI interviewer config, LiveKit tokens, state machine, transcript/report (Phase 3)
```

Every response is `{ success: true, data }` or `{ success: false, message, error }`. Notifications has no
routes of its own — other modules call `email.service.js` directly on status changes. `/interviews` has
three tiers: candidate/company JWT routes, plus a `/worker/*` set authenticated by a shared secret
instead (the livekit-worker process has no user credentials).

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
node scripts/test-phase3-interview.mjs path/to/resume.docx      # full AI interview: config, state machine,
                                                                 #   follow-ups, transcript, report, events, RBAC
node scripts/test-race-condition.mjs path/to/resume.docx        # two candidates racing for one slot (Phase 2)
```

`test-phase3-interview.mjs` drives the entire interview engine — question generation, follow-up logic,
stage transitions, report generation — by posting simulated transcripts to the same `/worker/answer`
endpoint the real livekit-worker calls. It covers everything except the literal realtime audio path
(STT/TTS over a live LiveKit room), which needs an actual browser and microphone to exercise — see
`livekit-worker/README.md` for how to test that part once you have real LiveKit/Deepgram credentials.

## Future phases

Not implemented — the architecture is designed so these slot in without restructuring anything above:

- **Phase 2 remainder:** Google Calendar sync, an optional Twilio AI scheduling call. Both would extend
  `scheduling.service.js` rather than needing new endpoints.
- **Phase 3 remainder:** video recording is deliberately never implemented (by design, not as a gap —
  see [AI voice interviews](#ai-voice-interviews-phase-3)). Swapping Deepgram for another STT/TTS
  provider means changing `livekit-worker/src/deepgram.js` only.
