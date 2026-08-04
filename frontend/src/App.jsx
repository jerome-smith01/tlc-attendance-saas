import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';

const Dashboard = () => {
  const { signOut, user } = useAuth();
  return (
    <div style={{ padding: '2rem', color: 'var(--foreground)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
      <h1>Dashboard</h1>
      <p>Logged in as: {user?.email}</p>
      <p>Coming in Phase 3.</p>
      <button className="btn-primary" style={{ width: 'auto' }} onClick={signOut}>
        Sign Out
      </button>
    </div>
  );
};

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
