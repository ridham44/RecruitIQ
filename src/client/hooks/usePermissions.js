import { useAuth } from './useAuth.jsx';

// Build plan P2: what the logged-in company-side user may do. The owner
// (role COMPANY) can do everything; a RECRUITER only what their membership
// grants. Only hides UI — the server enforces the same rules.
export function usePermissions() {
  const { user } = useAuth();
  const isOwner = user?.role === 'COMPANY';
  const isRecruiter = user?.role === 'RECRUITER';
  const granted = user?.membership?.permissions || [];

  const can = (permission) => isOwner || (isRecruiter && granted.includes(permission));

  return { can, isOwner, isRecruiter };
}
