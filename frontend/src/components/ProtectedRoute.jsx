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
    
    // Loosely match variations of admin/leader roles (e.g. 'global_admin', 'troop_admin', 'adult_leader')
    const isAdminOrLeader = isGlobalAdmin || (userRole && (userRole.includes('admin') || userRole.includes('leader') || userRole === 'owner'));
    const isAuthorized = isAdminOrLeader || (userRole && allowedRoles.includes(userRole));
    
    if (!isAuthorized) {
      const fallbackPath = userRole === 'badge_scanner' ? '/scanner' : '/dashboard';
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return children;
}

