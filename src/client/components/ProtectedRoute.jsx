import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import LoadingState from './ui/LoadingState.jsx';

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'COMPANY' ? '/company/dashboard' : '/candidate/dashboard'} replace />;
  }

  return children;
}
