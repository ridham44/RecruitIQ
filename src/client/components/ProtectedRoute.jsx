import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import LoadingState from './ui/LoadingState.jsx';
import { homePathForRole } from '../utils/homePath.js';

// export default function ProtectedRoute({ role, children }) {
// Build plan P2: `roles` allows several roles (the company area is shared by
// owners and recruiters); `role` still works exactly as before.
export default function ProtectedRoute({ role, roles, children }) {
  const { user, loading } = useAuth();
  const allowed = roles || (role ? [role] : null);

  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/auth/login" replace />;
  // if (role && user.role !== role) {
  if (allowed && !allowed.includes(user.role)) {
    // return <Navigate to={user.role === 'COMPANY' ? '/company/dashboard' : '/candidate/dashboard'} replace />;
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return children;
}
