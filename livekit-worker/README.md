# RecruitIQ LiveKit Worker (Phase 3)

The realtime voice half of the AI interview (Section 6). A **separate, long-running Node.js process** —
never deployed to Vercel, since a serverless function can't hold a persistent room connection or run
indefinitely. Deploy it anywhere that runs a normal Node process: Railway, Fly.io, Render, a small VM,
etc.

## What it does

1. LiveKit calls this worker's `/webhook/livekit` endpoint (`room_started`) when a candidate joins their
   interview room.
2. The worker joins that same room as a second participant, identity `ai-interviewer`.
3. It subscribes to the candidate's microphone track and streams it to Deepgram's realtime STT.
4. When Deepgram detects the candidate finished speaking (`speech_final`/`UtteranceEnd` — no hand-rolled
   VAD), the transcript is POSTed to the main app's `/api/v1/interviews/:id/worker/answer` endpoint.
5. The main app (not this worker) decides what happens next — follow-up, next question, or end of
   interview — and returns the text to say.
6. The worker synthesizes that text via Deepgram TTS and publishes it back into the room as its own
   audio track.
7. Repeat until the backend reports the interview is done, then the worker disconnects.

This worker **never** talks to Postgres or OpenRouter directly, and never decides interview logic itself
— every decision comes from the Vercel app, authenticated via a shared secret
(`INTERVIEW_WORKER_SECRET`, same value in both `.env` files). That split is deliberate: business logic
and the database stay in one place (the Vercel app), and this process only ever handles realtime
audio transport.

## Setup

```bash
cd livekit-worker
npm install
cp .env.example .env
# fill in LIVEKIT_URL/API_KEY/API_SECRET (same project as the main app),
# DEEPGRAM_API_KEY, BACKEND_URL (the main app's URL), and
# INTERVIEW_WORKER_SECRET (must match the main app's .env exactly)
npm start
```

Then point your LiveKit project's webhook URL at this worker:

```bash
# via the LiveKit CLI
lk project update-webhook --url https://<this-worker-host>/webhook/livekit
```

Or set it in the LiveKit Cloud dashboard under your project's Settings → Webhooks. In local development,
expose `WEBHOOK_PORT` (default 4001) with a tunnel (e.g. `ngrok http 4001`) so LiveKit Cloud can reach it.

## Testing without a real browser/microphone

The realtime audio path (this worker joining a room, streaming STT, playing TTS back) can only really be
exercised with a live LiveKit room, a browser, and a microphone/speaker — there's no way to simulate
that from a script. Everything **else** — the interview state machine, question generation, follow-up
logic, transcript storage, and report generation — is fully covered by the main app's
`scripts/test-phase3-interview.mjs`, which drives the exact same `/worker/answer` endpoint this worker
calls, just with a simulated transcript instead of real speech. Run that first to confirm the backend
side is healthy before testing this worker against a real interview.

## Deployment

- Any host that runs a persistent Node process works (Railway, Fly.io, Render, a small VM, a container
  on any cloud). It does **not** go on Vercel.
- Set the same environment variables as `.env.example`, pointing `BACKEND_URL` at your deployed Vercel
  app's URL and using the same `INTERVIEW_WORKER_SECRET` configured there.
- Expose `WEBHOOK_PORT` publicly (behind TLS in production) and point LiveKit's webhook URL at it.
- This process has no HTTP API of its own beyond the webhook endpoint — nothing else needs to reach it
  directly.
