import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { ThemeToggle } from './ThemeToggle';

export function SidebarLayout() {
  const { signOut, user } = useAuth();
  const { troops, selectedTroopId, setSelectedTroopId, loadingTroops, selectedTroop, isGlobalAdmin } = useTroop();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [troopDropdownOpen, setTroopDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Handle click outside of troop switcher dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setTroopDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setMobileNavOpen(false);
    await signOut();
    navigate('/login');
  };

  const linkStyle = (path) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'));
    return {
      display: 'block',
      padding: '0.75rem 1rem',
      textDecoration: 'none',
      color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
      backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
      borderRadius: '8px',
      marginBottom: '0.5rem',
      fontWeight: isActive ? '600' : '400',
      transition: 'all var(--transition-fast)',
    };
  };

  const currentUserRole = selectedTroop?.currentUserRole || '';

  const allNavLinks = [
    { path: '/dashboard', label: 'Dashboard', allowedRoles: ['troop_admin', 'billing_admin', 'global_admin'] },
    { path: '/roster', label: 'Roster', allowedRoles: ['troop_admin', 'billing_admin', 'global_admin'] },
    { path: '/events', label: 'Events', allowedRoles: ['badge_scanner', 'troop_admin', 'billing_admin', 'global_admin'] },
    { path: '/billing', label: 'Billing', allowedRoles: ['billing_admin', 'global_admin'] },
    { path: '/complete-profile', label: 'Profile', allowedRoles: ['badge_scanner', 'troop_admin', 'billing_admin', 'global_admin'] },
  ];

  const visibleNavLinks = allNavLinks.filter(link => {
    if (isGlobalAdmin) return true;
    return link.allowedRoles.includes(currentUserRole);
  });

  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      const parts = user.user_metadata.full_name.split(' ');
      if (parts.length > 1) {
        return `${parts[0]} ${parts[parts.length - 1][0]}.`;
      }
      return parts[0];
    }
    return user?.email?.split('@')[0] || 'Unknown User';
  };

  const getFriendlyRole = () => {
    if (isGlobalAdmin) return 'Global Admin';
    if (currentUserRole === 'billing_admin') return 'Billing Admin';
    if (currentUserRole === 'troop_admin') return 'Troop Admin';
    if (currentUserRole === 'badge_scanner') return 'Scanner';
    return '';
  };

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

        <h2 style={{ padding: '0 1rem', marginBottom: '2rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          TLC Attendance
        </h2>
        
        <div style={{ flexGrow: 1 }}>
          {visibleNavLinks.map(link => (
            <Link 
              key={link.path} 
              to={link.path} 
              style={linkStyle(link.path)} 
              onClick={() => setMobileNavOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <div style={{ margin: '0 0 1rem 0', overflow: 'hidden' }}>
            <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: '500', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {getDisplayName()}
            </p>
            {getFriendlyRole() && (
              <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.75rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {getFriendlyRole()}
              </p>
            )}
          </div>
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
            <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>Active Troop:</span>
              
              {/* Custom Glassmorphic Troop Switcher Dropdown */}
              <button
                type="button"
                onClick={() => setTroopDropdownOpen(!troopDropdownOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <span>{selectedTroop ? selectedTroop.troop_number : 'Select Troop'}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{troopDropdownOpen ? '▲' : '▼'}</span>
              </button>

              {troopDropdownOpen && (
                <div 
                  className="glass-card"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    minWidth: '160px',
                    zIndex: 1000,
                    padding: '0.4rem 0',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  {troops.map(t => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTroopId(t.id);
                        setTroopDropdownOpen(false);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: t.id === selectedTroopId ? '600' : '400',
                        color: t.id === selectedTroopId ? 'var(--color-primary)' : 'var(--text-primary)',
                        backgroundColor: t.id === selectedTroopId ? 'var(--bg-elevated)' : 'transparent',
                        transition: 'background-color var(--transition-fast)'
                      }}
                    >
                      {t.troop_number}
                    </div>
                  ))}
                </div>
              )}
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

