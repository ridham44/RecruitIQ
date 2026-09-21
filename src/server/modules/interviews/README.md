# interviews (Phase 3 — not implemented)

Will handle the AI voice interview flow: LiveKit room orchestration,
STT/TTS, dynamic question generation via OpenRouter, transcript capture,
and AI evaluation.

Planned files:

- `interviews.routes.js` — mounted at `/api/v1/interviews`
- `interviews.controller.js`
- `interviews.service.js`
- `interview-evaluator.service.js` — reuses `src/server/ai/openrouter.service.js`

Important (Section 21): the realtime LiveKit voice agent is a
long-running process and must NOT run inside a Vercel serverless function.
This module's Express routes only handle request/response concerns (create
interview session, fetch transcript, fetch report); the actual voice agent
runs as a separate worker service that talks to LiveKit directly.

Will introduce `Interview`, `InterviewQuestion`, `InterviewAnswer`, and
`InterviewReport` models, referencing `Application` by id.
