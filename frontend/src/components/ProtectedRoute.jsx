import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppSpinner } from './AppSpinner';

export function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  // Hold rendering until the initial getSession() call resolves.
  // Without this, there is a 1-frame flash of the Login page on every refresh.
  if (loading) return <AppSpinner />;

  // (A) Silent redirect — no message
  if (!session) return <Navigate to="/login" replace />;

  return children;
}
