import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TroopProvider } from './context/TroopContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SidebarLayout } from './components/SidebarLayout';
import { Login } from './pages/Login';
import { CompleteProfile } from './pages/CompleteProfile';
import { Dashboard } from './pages/Dashboard';
import { Scanner } from './pages/Scanner';
import { Roster } from './pages/Roster';
import { Sessions } from './pages/Sessions';
import { Billing } from './pages/Billing';

export default function App() {
  return (
    <AuthProvider>
      <TroopProvider>
        <HashRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected with Sidebar Layout */}
            <Route element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>}>
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/roster" element={<Roster />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/billing" element={<Billing />} />
            </Route>

            {/* Default — redirect root to login; AuthContext will bounce to dashboard if logged in */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </HashRouter>
      </TroopProvider>
    </AuthProvider>
  );
}
