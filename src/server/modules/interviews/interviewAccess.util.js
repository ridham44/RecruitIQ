// Build plan P9 — the access rules shared by the interview link page
// (instantInterview.service.js blocker) and the interview engine's start
// (interviewEngine.service.js), so a candidate can never bypass them by
// calling the API directly with a normal login instead of the link.
//
// `interview` must include application.job.company. Only a SCHEDULED
// (not yet started) interview is ever blocked here: one already IN_PROGRESS
// can always be rejoined after a dropped connection.
//
//  - Suspended agency → no new interviews (every link-based interview).
//  - /recq application → the job's interview window is authoritative:
//      before interviewAvailabilityStart → INTERVIEW_NOT_OPEN
//      after  interviewAvailabilityEnd   → INVITE_EXPIRED
//    Slot / shortlist-instant interviews keep their own rules unchanged.
export function interviewAccessBlocker(interview, now = new Date()) {
  if (interview.status !== 'SCHEDULED') return null;
  const job = interview.application?.job;

  if (job?.company?.status === 'SUSPENDED') {
    return { code: 'AGENCY_UNAVAILABLE', message: 'This recruitment agency is currently unavailable.' };
  }

  if (interview.application?.source !== 'RECQ' || !job) return null;
  const start = job.interviewAvailabilityStart ? new Date(job.interviewAvailabilityStart) : null;
  const end = job.interviewAvailabilityEnd ? new Date(job.interviewAvailabilityEnd) : null;
  if (start && start > now) {
    return { code: 'INTERVIEW_NOT_OPEN', message: 'Your interview is not available yet.', availableFrom: start };
  }
  if (end && end <= now) {
    return {
      code: 'INVITE_EXPIRED',
      message: 'Your interview window has expired. Please contact the recruitment agency if you need assistance.',
    };
  }
  return null;
}
