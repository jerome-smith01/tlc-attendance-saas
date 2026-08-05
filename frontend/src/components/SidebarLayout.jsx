import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { ThemeToggle } from './ThemeToggle';

export function SidebarLayout() {
  const { signOut, user } = useAuth();
  const { troops, selectedTroopId, setSelectedTroopId, loadingTroops } = useTroop();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    setMobileNavOpen(false);
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
    <div className="layout-root">
      {/* Backdrop for mobile navigation */}
      <div 
        className={`nav-backdrop ${mobileNavOpen ? 'open' : ''}`} 
        onClick={() => setMobileNavOpen(false)}
      />

      {/* Sidebar Navigation */}
      <nav className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <button 
          className="sidebar-close-btn" 
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
        >
          ✕
        </button>

        <h2 style={{ padding: '0 1rem', marginBottom: '2rem', color: 'var(--text-primary)' }}>TLC Attendance</h2>
        
        <div style={{ flexGrow: 1 }}>
          <Link to="/dashboard" style={linkStyle('/dashboard')} onClick={() => setMobileNavOpen(false)}>
            Dashboard
          </Link>
          <Link to="/roster" style={linkStyle('/roster')} onClick={() => setMobileNavOpen(false)}>
            Roster
          </Link>
          <Link to="/sessions" style={linkStyle('/sessions')} onClick={() => setMobileNavOpen(false)}>
            Sessions
          </Link>
          <Link to="/scanner" style={linkStyle('/scanner')} onClick={() => setMobileNavOpen(false)}>
            Scanner
          </Link>
          <Link to="/billing" style={linkStyle('/billing')} onClick={() => setMobileNavOpen(false)}>
            Billing
          </Link>
          <Link to="/complete-profile" style={linkStyle('/complete-profile')} onClick={() => setMobileNavOpen(false)}>
            Profile
          </Link>
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      <div className="layout-body">
        {/* Top Navbar */}
        <header className="layout-header">
          <button 
            className="hamburger-btn" 
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            ☰
          </button>

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
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
