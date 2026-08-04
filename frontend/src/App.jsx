import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { CompleteProfile } from './pages/CompleteProfile';

import { Dashboard } from './pages/Dashboard';

const Scanner = () => (
  <div style={{ padding: '2rem', color: 'var(--foreground)' }}>
    <h1>Scanner</h1>
    <p>Coming in Phase 4.</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected */}
          <Route path="/complete-profile" element={
            <ProtectedRoute><CompleteProfile /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/scanner" element={
            <ProtectedRoute><Scanner /></ProtectedRoute>
          } />

          {/* Default — redirect root to login; AuthContext will bounce to dashboard if logged in */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
