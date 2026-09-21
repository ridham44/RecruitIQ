# notifications (Phase 2 — not implemented)

Will handle emailing shortlisted candidates via Brevo (`BREVO_API_KEY`).
Planned files, following the same pattern as other modules:

- `notifications.routes.js` — mounted at `/api/v1/notifications`
- `notifications.controller.js`
- `notifications.service.js`
- `brevo.client.js` — wraps the Brevo SDK/API, analogous to `src/server/ai/openrouter.service.js`

Will read `Application`/`Candidate` records but must not require changes to
the Phase 1 schema — an `EmailLog` model will be added to track sends.
