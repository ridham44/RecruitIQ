# scheduling (Phase 2 — not implemented)

Will handle candidates accepting/rejecting interview invites and picking a
time slot, optionally backed by Google Calendar, plus an optional Twilio-based
AI scheduling call.

Planned files:

- `scheduling.routes.js` — mounted at `/api/v1/scheduling`
- `scheduling.controller.js`
- `scheduling.service.js`
- `calendar.client.js`
- `twilio.client.js`

Will introduce `InterviewSchedule` and `CallLog` models and new
`ApplicationStatus` values (e.g. `INTERVIEW_SCHEDULED`) appended to the
Phase 1 enum without repurposing existing values.
