export const ROLES = {
  ADMIN: 'ADMIN',
  COMPANY: 'COMPANY',
  CANDIDATE: 'CANDIDATE',
  RECRUITER: 'RECRUITER',
  INTERVIEWER: 'INTERVIEWER',
};

// Roles that can currently register/authenticate in Phase 1.
export const PHASE1_ROLES = [ROLES.COMPANY, ROLES.CANDIDATE];

// Build plan P2: users who work inside a recruitment company — the owner
// (COMPANY) and the recruiters they invite. What a RECRUITER may actually do
// is narrowed further by their CompanyMember permissions and job assignments.
export const COMPANY_SIDE_ROLES = [ROLES.COMPANY, ROLES.RECRUITER];

export function isCompanySide(role) {
  return COMPANY_SIDE_ROLES.includes(role);
}
