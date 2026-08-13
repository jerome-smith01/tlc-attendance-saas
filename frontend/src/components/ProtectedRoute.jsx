import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { AppSpinner } from './AppSpinner';

export function ProtectedRoute({ children, allowedRoles = null }) {
  const { session, loading: authLoading } = useAuth();
  const { selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();

  // Hold rendering until initial session & troops resolve.
  if (authLoading || (session && loadingTroops)) return <AppSpinner />;

  // Redirect unauthenticated users
  if (!session) return <Navigate to="/login" replace />;

  // Role authorization check
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = selectedTroop?.currentUserRole;
    
    // global_admin has access to everything
    const isAdminOrLeader = isGlobalAdmin;
    const isAuthorized = isAdminOrLeader || (userRole && allowedRoles.includes(userRole));
    
    if (!isAuthorized) {
      let fallbackPath = '/dashboard';
      if (userRole === 'badge_scanner') fallbackPath = '/events';
      else if (!userRole) fallbackPath = '/profile';
      
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return children;
}

