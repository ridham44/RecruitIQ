// Where each role lands after login/registration (build plan P1 adds ADMIN).
export function homePathForRole(role) {
  if (role === 'ADMIN') return '/admin/companies';
  if (role === 'COMPANY') return '/company/dashboard';
  return '/candidate/dashboard';
}
