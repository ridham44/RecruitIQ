# notifications (Phase 2)

Sends status-change and interview-confirmation emails. No routes/controller —
there's no user-facing "notifications" endpoint; other modules (applications,
screening, scheduling) call `email.service.js` directly when a candidate's
`Application.status` changes or an interview is booked.

- `email.service.js` — templates (shortlisted/rejected/interview confirmation)
  and `EmailLog` persistence. Never throws: a broken email provider must
  never fail the request that triggered the notification.
- `drivers/` — the same seam pattern as `src/server/resume/storage/`:
  `brevo.driver.js` sends via Brevo's transactional email REST API,
  `console.driver.js` logs instead of sending (the fallback when
  `BREVO_API_KEY` isn't set, so the app never crashes for lack of email
  config), `drivers/index.js` picks one. Adding a second provider later
  means adding a driver file — nothing in `email.service.js` changes.

Every send attempt (success or failure) is recorded in `EmailLog` for
auditability, keyed loosely to `applicationId` (not a hard foreign key —
audit rows should outlive the application they're about).
