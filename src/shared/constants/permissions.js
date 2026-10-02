// Build plan P2: what a RECRUITER may do inside their recruitment company.
// The OWNER (role COMPANY) implicitly has every permission. Stored as plain
// strings in CompanyMember.permissions, so keys can be added later without
// a migration.
export const PERMISSIONS = {
  MANAGE_JOBS: 'MANAGE_JOBS',
  // View-only: applicants on assigned jobs, their CV (view / download) and scores.
  VIEW_CANDIDATES: 'VIEW_CANDIDATES',
  REVIEW_CANDIDATES: 'REVIEW_CANDIDATES',
  CONFIGURE_INTERVIEWS: 'CONFIGURE_INTERVIEWS',
  MANAGE_RECRUITERS: 'MANAGE_RECRUITERS',
  // Build plan P3: client companies, departments and HR persons.
  MANAGE_CLIENTS: 'MANAGE_CLIENTS',
  // Build plan P7: send candidate packages to client HR.
  SUBMIT_CANDIDATES: 'SUBMIT_CANDIDATES',
};

// Shown in the invite / edit-permissions UI, in this order.
export const PERMISSION_OPTIONS = [
  { key: PERMISSIONS.VIEW_CANDIDATES, label: 'View candidates', description: 'See applicants on assigned jobs, open / download CVs and scores (no actions)' },
  { key: PERMISSIONS.MANAGE_JOBS, label: 'Manage jobs', description: 'Create, edit and close jobs' },
  { key: PERMISSIONS.REVIEW_CANDIDATES, label: 'Review candidates', description: 'Applicants, AI screening, shortlist/reject, interview results' },
  { key: PERMISSIONS.CONFIGURE_INTERVIEWS, label: 'Configure interviews', description: 'AI interviewer settings and interview slots' },
  { key: PERMISSIONS.MANAGE_RECRUITERS, label: 'Manage agency recruiters', description: 'Invite agency recruiters, set permissions and job assignments' },
  // Build plan P3
  { key: PERMISSIONS.MANAGE_CLIENTS, label: 'Manage companies', description: 'Companies, departments and Company HR' },
  // Build plan P7
  { key: PERMISSIONS.SUBMIT_CANDIDATES, label: 'Submit candidates', description: 'Send qualified candidates to Company HR' },
];

export const ASSIGNABLE_PERMISSIONS = PERMISSION_OPTIONS.map((p) => p.key);

// export const DEFAULT_RECRUITER_PERMISSIONS = [PERMISSIONS.REVIEW_CANDIDATES, PERMISSIONS.CONFIGURE_INTERVIEWS];
// New recruiters start view-only; existing recruiters keep what they were given.
export const DEFAULT_RECRUITER_PERMISSIONS = [PERMISSIONS.VIEW_CANDIDATES];

// Any of these lets a recruiter READ applicants / CVs / scores / interview results.
export const VIEW_CANDIDATE_PERMISSIONS = [PERMISSIONS.VIEW_CANDIDATES, PERMISSIONS.REVIEW_CANDIDATES];
