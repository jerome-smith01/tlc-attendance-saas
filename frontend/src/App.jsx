import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TroopProvider } from './context/TroopContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SidebarLayout } from './components/SidebarLayout';
import { ToastProvider } from './components/common/ToastContext';
import { ConfirmProvider } from './components/common/ConfirmContext';
import { Login } from './pages/Login';
import { Landing } from './pages/Landing';
import { AcceptInvite } from './pages/AcceptInvite';
import { InviteError } from './pages/InviteError';
import { Profile } from './pages/Profile';
import { Dashboard } from './pages/Dashboard';
import { Scanner } from './pages/Scanner';
import { Roster } from './pages/Roster';
import { EditMember } from './pages/EditMember';
import { Events } from './pages/Events';
import { Billing } from './pages/Billing';
import { Extension } from './pages/Extension';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';

export default function App() {
  return (
    <AuthProvider>
      <TroopProvider>
        <ToastProvider>
          <ConfirmProvider>
            <HashRouter>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />
                <Route path="/invite-error" element={<InviteError />} />

                {/* Protected with Sidebar Layout */}
                <Route element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>}>
                  <Route path="/profile" element={<Profile />} />
                  <Route 
                    path="/dashboard" 
                    element={
                      <ProtectedRoute allowedRoles={['roster_manager', 'troop_admin', 'global_admin']}>
                        <Dashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/troop/:troopNumber/dashboard" 
                    element={
                      <ProtectedRoute allowedRoles={['roster_manager', 'troop_admin', 'global_admin']}>
                        <Dashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/events/:eventId" 
                    element={
                      <ProtectedRoute allowedRoles={['badge_scanner', 'roster_manager', 'troop_admin', 'global_admin']}>
                        <Scanner />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/troop/:troopNumber/events/:eventId" 
                    element={
                      <ProtectedRoute allowedRoles={['badge_scanner', 'roster_manager', 'troop_admin', 'global_admin']}>
                        <Scanner />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/roster" 
                    element={<Navigate to="/roster/members" replace />} 
                  />
                  <Route 
                    path="/roster/:tab" 
                    element={
                      <ProtectedRoute allowedRoles={['roster_manager', 'troop_admin', 'global_admin']}>
                        <Roster />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/roster/:memberId/edit" 
                    element={
                      <ProtectedRoute allowedRoles={['roster_manager', 'troop_admin', 'global_admin']}>
                        <EditMember />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/troop/:troopNumber/roster/:tab" 
                    element={
                      <ProtectedRoute allowedRoles={['roster_manager', 'troop_admin', 'global_admin']}>
                        <Roster />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/troop/:troopNumber/roster/:memberId/edit" 
                    element={
                      <ProtectedRoute allowedRoles={['roster_manager', 'troop_admin', 'global_admin']}>
                        <EditMember />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/events" 
                    element={
                      <ProtectedRoute allowedRoles={['badge_scanner', 'roster_manager', 'troop_admin', 'global_admin']}>
                        <Events />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/troop/:troopNumber/events" 
                    element={
                      <ProtectedRoute allowedRoles={['badge_scanner', 'roster_manager', 'troop_admin', 'global_admin']}>
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
                      <ProtectedRoute allowedRoles={['troop_admin', 'global_admin']}>
                        <Billing />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/troop/:troopNumber/billing" 
                    element={
                      <ProtectedRoute allowedRoles={['troop_admin', 'global_admin']}>
                        <Billing />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/extension" 
                    element={<Extension />} 
                  />
                  <Route 
                    path="/troop/:troopNumber/extension" 
                    element={<Extension />} 
                  />
                </Route>

                {/* Default — redirect unknown routes to root landing page */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
        </HashRouter>
          </ConfirmProvider>
        </ToastProvider>
      </TroopProvider>
    </AuthProvider>
  );
}
