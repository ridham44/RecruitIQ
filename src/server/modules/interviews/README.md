# interviews (Phase 3)

AI voice interview: configuration, LiveKit token generation, the interview
state machine, transcript storage, and report generation. The realtime
voice agent itself lives in `livekit-worker/` at the repo root — a separate
long-running process, not part of this Vercel app (Section 6/21).

- `interviewConfig.service.js` — per-job AI interviewer settings
  (`AiInterviewConfig`: name, title, question count, answer timer, custom
  questions). Falls back to sane defaults when a company hasn't configured
  one, so AI slot generation/booking never depends on it existing.
- `livekit.service.js` — the only place `LIVEKIT_API_SECRET` is read. Signs
  a short-lived, room-scoped token for the candidate and returns it —
  never touches audio itself.
- `interviewEngine.service.js` — the state machine (Section 5). A fixed,
  backend-owned stage order (`INTERVIEW_STAGES` in
  `shared/constants/statuses.js`) with a deterministic per-stage question
  budget; the LLM only ever chooses question wording and whether a
  follow-up is warranted (capped by a deterministic budget), never the
  stage order or count. `advanceInterview()` is what the livekit-worker
  calls after each candidate answer; `finalizeInterview()` triggers the
  final report synchronously (awaited, not fire-and-forget — this is a
  Vercel function, which doesn't run code after the response is sent).
- `interviews.routes.js` — three authorization tiers on one router:
  candidate/company JWT routes, and a set of `/worker/*` routes gated by a
  shared secret instead (`workerAuth.js`) since the livekit-worker process
  has no user credentials of its own.

Reuses rather than duplicates: `getOwnedJob` (jobs module) for company
authorization, the same booking flow as Phase 2 scheduling (an "AI
interview slot" is just a normal `InterviewSlot` — nothing about slot
creation/booking changed), and `computeSkillOverlap` (screening module) for
the report's deterministic resume/job alignment component.
