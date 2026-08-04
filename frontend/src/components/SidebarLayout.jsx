import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { ThemeToggle } from './ThemeToggle';

export function SidebarLayout() {
  const { signOut, user } = useAuth();
  const { troops, selectedTroopId, setSelectedTroopId, loadingTroops } = useTroop();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const linkStyle = (path) => ({
    display: 'block',
    padding: '0.75rem 1rem',
    textDecoration: 'none',
    color: location.pathname === path ? 'var(--text-primary)' : 'var(--text-secondary)',
    backgroundColor: location.pathname === path ? 'var(--bg-elevated)' : 'transparent',
    borderRadius: '8px',
    marginBottom: '0.5rem',
    fontWeight: location.pathname === path ? '600' : '400',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <nav style={{ 
        width: '240px', 
        borderRight: '1px solid var(--border-color)', 
        padding: '1.5rem 1rem', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <h2 style={{ padding: '0 1rem', marginBottom: '2rem', color: 'var(--text-primary)' }}>TLC Attendance</h2>
        
        <div style={{ flexGrow: 1 }}>
          <Link to="/dashboard" style={linkStyle('/dashboard')}>
            Dashboard
          </Link>
          <Link to="/roster" style={linkStyle('/roster')}>
            Roster
          </Link>
          <Link to="/sessions" style={linkStyle('/sessions')}>
            Sessions
          </Link>
          <Link to="/scanner" style={linkStyle('/scanner')}>
            Scanner
          </Link>
          <Link to="/billing" style={linkStyle('/billing')}>
            Billing
          </Link>
          <Link to="/complete-profile" style={linkStyle('/complete-profile')}>
            Profile
          </Link>
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {user?.email}
          </p>
          <button 
            onClick={handleSignOut}
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              background: 'transparent', 
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Top Navbar */}
        <header style={{ 
          height: '64px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 2rem',
          gap: '1rem'
        }}>
          {loadingTroops ? (
            <span style={{ color: 'var(--text-secondary)' }}>Loading context...</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="global-troop-select" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Active Troop:</label>
              <select 
                id="global-troop-select"
                value={selectedTroopId}
                onChange={e => setSelectedTroopId(e.target.value)}
                style={{ padding: '0.4rem', fontSize: '0.9rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {troops.map(t => (
                  <option key={t.id} value={t.id}>{t.troop_number}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />
          <ThemeToggle />
        </header>

        {/* Page Content */}
        <main style={{ flexGrow: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
