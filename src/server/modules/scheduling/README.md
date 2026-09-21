# scheduling (Phase 2)

RecruitIQ is its own scheduling system for now — no Google Calendar or
Twilio integration yet (that's a documented future step, not implemented).

- `scheduling.service.js` — company creates `InterviewSlot`s for a job, one
  at a time (`createSlots`) or generated in bulk from a time range + interview
  duration + optional buffer (`generateSlots` — "Create AI Interview Slots";
  overlapping-with-existing candidates are skipped, not errored, so
  re-running generation over a partially-filled day is safe). Both paths
  produce the same `InterviewSlot` rows, so everything downstream (booking,
  cancelling, the candidate's available-slots list) is identical either way.
- Candidates book one once `SHORTLISTED`, which atomically flips the slot to
  `BOOKED` (a conditional `updateMany` prevents two candidates racing for
  the same slot) and creates an `Interview` row + moves the application to
  `INTERVIEW_SCHEDULED`. Cancelling (by either side) frees the slot back to
  `AVAILABLE` and reverts the application to `SHORTLISTED` so the candidate
  can rebook — this is the "Reschedule" feature.
- Mounted at `/api/v1/scheduling`.

Future, without restructuring this module:

- `calendar.client.js` — sync booked slots to Google Calendar.
- `twilio.client.js` — an optional AI scheduling call.

Both would plug into the same `bookSlot`/`cancelSlot` service functions
rather than requiring new endpoints.
