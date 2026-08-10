import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TroopProvider } from './context/TroopContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SidebarLayout } from './components/SidebarLayout';
import { ToastProvider } from './components/common/ToastContext';
import { ConfirmProvider } from './components/common/ConfirmContext';
import { Login } from './pages/Login';
import { CompleteProfile } from './pages/CompleteProfile';
import { Dashboard } from './pages/Dashboard';
import { Scanner } from './pages/Scanner';
import { Roster } from './pages/Roster';
import { EditMember } from './pages/EditMember';
import { Events } from './pages/Events';
import { Billing } from './pages/Billing';

export default function App() {
  return (
    <AuthProvider>
      <TroopProvider>
        <ToastProvider>
          <ConfirmProvider>
            <HashRouter>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

                {/* Protected with Sidebar Layout */}
                <Route element={<ProtectedRoute allowedRoles={['badge_scanner', 'troop_admin', 'billing_admin', 'global_admin']}><SidebarLayout /></ProtectedRoute>}>
                  <Route path="/complete-profile" element={<CompleteProfile />} />
                  <Route 
                    path="/dashboard" 
                    element={
                      <ProtectedRoute allowedRoles={['troop_admin', 'billing_admin', 'global_admin']}>
                        <Dashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/events/:eventId" 
                    element={
                      <ProtectedRoute allowedRoles={['badge_scanner', 'troop_admin', 'billing_admin', 'global_admin']}>
                        <Scanner />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/roster" 
                    element={
                      <ProtectedRoute allowedRoles={['troop_admin', 'billing_admin', 'global_admin']}>
                        <Roster />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/roster/:memberId/edit" 
                    element={
                      <ProtectedRoute allowedRoles={['troop_admin', 'billing_admin', 'global_admin']}>
                        <EditMember />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/events" 
                    element={
                      <ProtectedRoute allowedRoles={['badge_scanner', 'troop_admin', 'billing_admin', 'global_admin']}>
                        <Events />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/sessions" 
                    element={<Navigate to="/events" replace />} 
                  />
                  <Route 
                    path="/billing" 
                    element={
                      <ProtectedRoute allowedRoles={['billing_admin', 'global_admin']}>
                        <Billing />
                      </ProtectedRoute>
                    } 
                  />
                </Route>

                {/* Default — redirect root to login; AuthContext will bounce to dashboard if logged in */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </HashRouter>
          </ConfirmProvider>
        </ToastProvider>
      </TroopProvider>
    </AuthProvider>
  );
}
