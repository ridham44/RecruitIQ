// Per-application Reject button state, derived entirely from the
// application's own status (never local UI state), so it reflects reality
// after a refresh. Screening and interview scheduling are no longer
// per-candidate actions — screening runs job-wide from the Applications
// page, and interview scheduling is candidate self-service once shortlisted
// (see the Interview Scheduling page and scheduling.service.js).
export function getApplicationActionState(app) {
  const rejected = app.status === 'REJECTED';

  return {
    reject: {
      disabled: rejected,
      label: rejected ? 'Rejected' : 'Reject',
      title: rejected ? 'This application has already been rejected' : '',
    },
  };
}
