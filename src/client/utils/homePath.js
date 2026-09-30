// Where each role lands after login/registration (build plan P1 adds ADMIN).
export function homePathForRole(role) {
  if (role === 'ADMIN') return '/admin/companies';
  // if (role === 'COMPANY') return '/company/dashboard';
  // Build plan P2: recruiters share the company area.
  if (role === 'COMPANY' || role === 'RECRUITER') return '/company/dashboard';
  // Build plan P8: client HR portal.
  if (role === 'CLIENT_HR') return '/client/candidates';
  return '/candidate/dashboard';
}
