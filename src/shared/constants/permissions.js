// Build plan P2: what a RECRUITER may do inside their recruitment company.
// The OWNER (role COMPANY) implicitly has every permission. Stored as plain
// strings in CompanyMember.permissions, so keys can be added later without
// a migration.
export const PERMISSIONS = {
  MANAGE_JOBS: 'MANAGE_JOBS',
  REVIEW_CANDIDATES: 'REVIEW_CANDIDATES',
  CONFIGURE_INTERVIEWS: 'CONFIGURE_INTERVIEWS',
  MANAGE_RECRUITERS: 'MANAGE_RECRUITERS',
  // Reserved for later phases (P3 clients, P7 submissions) — not enforced yet.
  MANAGE_CLIENTS: 'MANAGE_CLIENTS',
  SUBMIT_CANDIDATES: 'SUBMIT_CANDIDATES',
};

// Shown in the invite / edit-permissions UI, in this order.
export const PERMISSION_OPTIONS = [
  { key: PERMISSIONS.MANAGE_JOBS, label: 'Manage jobs', description: 'Create, edit and close jobs' },
  { key: PERMISSIONS.REVIEW_CANDIDATES, label: 'Review candidates', description: 'Applicants, AI screening, shortlist/reject, interview results' },
  { key: PERMISSIONS.CONFIGURE_INTERVIEWS, label: 'Configure interviews', description: 'AI interviewer settings and interview slots' },
  { key: PERMISSIONS.MANAGE_RECRUITERS, label: 'Manage recruiters', description: 'Invite recruiters, set permissions and job assignments' },
];

export const ASSIGNABLE_PERMISSIONS = PERMISSION_OPTIONS.map((p) => p.key);

export const DEFAULT_RECRUITER_PERMISSIONS = [PERMISSIONS.REVIEW_CANDIDATES, PERMISSIONS.CONFIGURE_INTERVIEWS];
