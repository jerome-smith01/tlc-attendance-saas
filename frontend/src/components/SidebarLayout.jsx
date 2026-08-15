import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, CreditCard, User, Puzzle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { supabase } from '../lib/supabaseClient';
import { ThemeToggle } from './ThemeToggle';

export function SidebarLayout() {
  const { signOut, user } = useAuth();
  const { troops, selectedTroopId, setSelectedTroopId, loadingTroops, selectedTroop, selectedTroopIdentifier, isGlobalAdmin, userDisplayName } = useTroop();
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
    navigate('/');
  };

  const linkStyle = (path) => {
    const isSectionMatch = (section) => path.includes(`/${section}`) && location.pathname.includes(`/${section}`);
    const isActive = 
      isSectionMatch('dashboard') ||
      isSectionMatch('roster') ||
      isSectionMatch('events') ||
      isSectionMatch('billing') ||
      isSectionMatch('extension') ||
      location.pathname === path ||
      (path !== '/' && location.pathname.startsWith(path + '/'));

    return {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
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
  const currentTroopIdentifier = selectedTroopIdentifier || selectedTroopId;

  const dashboardPath = currentTroopIdentifier ? `/troop/${currentTroopIdentifier}/dashboard` : '/dashboard';
  const rosterPath = currentTroopIdentifier ? `/troop/${currentTroopIdentifier}/roster/members` : '/roster/members';
  const eventsPath = currentTroopIdentifier ? `/troop/${currentTroopIdentifier}/events` : '/events';
  const billingPath = currentTroopIdentifier ? `/troop/${currentTroopIdentifier}/billing` : '/billing';
  const extensionPath = currentTroopIdentifier ? `/troop/${currentTroopIdentifier}/extension` : '/extension';

  const allNavLinks = [
    { path: dashboardPath, label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['roster_manager', 'troop_admin', 'global_admin'] },
    { path: rosterPath, label: 'Roster', icon: Users, allowedRoles: ['roster_manager', 'troop_admin', 'global_admin'] },
    { path: eventsPath, label: 'Events', icon: Calendar, allowedRoles: ['badge_scanner', 'roster_manager', 'troop_admin', 'global_admin'] },
    { path: billingPath, label: 'Billing', icon: CreditCard, allowedRoles: ['troop_admin', 'global_admin'] },
    { path: extensionPath, label: 'TLC Extension', icon: Puzzle, allowedRoles: null },
    { path: '/profile', label: 'Profile', icon: User, allowedRoles: null },
  ];

  const visibleNavLinks = allNavLinks.filter(link => {
    if (!link.allowedRoles) return true;
    if (isGlobalAdmin) return true;
    return link.allowedRoles.includes(currentUserRole);
  });

  const getDisplayName = () => {
    if (userDisplayName) return userDisplayName;
    const metaFirst = user?.user_metadata?.first_name || user?.user_metadata?.given_name;
    const metaLast = user?.user_metadata?.last_initial || user?.user_metadata?.last_name || user?.user_metadata?.family_name;
    if (metaFirst) {
      const initial = metaLast ? ` ${metaLast.trim().charAt(0).toUpperCase()}.` : '';
      return `${metaFirst.trim()}${initial}`;
    }
    if (user?.user_metadata?.full_name || user?.user_metadata?.name) {
      const fullName = (user.user_metadata.full_name || user.user_metadata.name).trim();
      const parts = fullName.split(/\s+/);
      if (parts.length > 1) {
        return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
      }
      return parts[0];
    }
    return user?.email?.split('@')[0] || 'Unknown User';
  };

  const getFriendlyRole = () => {
    if (isGlobalAdmin) return 'Global Admin';
    if (currentUserRole === 'troop_admin') return 'Troop Admin';
    if (currentUserRole === 'roster_manager') return 'Roster Manager';
    if (currentUserRole === 'badge_scanner') return 'Scanner';
    return '';
  };

  return (
    <div className="layout-root">
      {/* Top Navbar */}
      <header className="layout-header">
        <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginRight: 'auto' }}>
          <button 
            className="hamburger-btn" 
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            style={{ marginRight: '0.5rem', margin: 0 }}
          >
            ☰
          </button>
          <div style={{ width: '32px', height: '32px', flexShrink: 0, backgroundColor: 'transparent' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2 className="header-title" style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>
            TLC Attendance
          </h2>
        </div>

        {loadingTroops ? (
          <span style={{ color: 'var(--text-secondary)' }}>Loading context...</span>
        ) : (
          <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="active-troop-label" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>Active Troop:</span>
            
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
                  right: 0,
                  minWidth: '160px',
                  zIndex: 1000,
                  padding: '0.4rem 0',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-elevated)'
                }}
              >
                {troops.map(t => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTroopId(t.id);
                      setTroopDropdownOpen(false);
                      const troopIdent = t.troop_number || t.id;
                      if (location.pathname.includes('/dashboard')) {
                        navigate(`/troop/${troopIdent}/dashboard`);
                      } else if (location.pathname.includes('/roster')) {
                        const isLeaders = location.pathname.endsWith('/leaders');
                        const targetTab = isLeaders ? 'leaders' : 'members';
                        navigate(`/troop/${troopIdent}/roster/${targetTab}`);
                      } else if (location.pathname.includes('/events')) {
                        const eventMatch = location.pathname.match(/\/events\/([^\/]+)/);
                        navigate(eventMatch ? `/troop/${troopIdent}/events/${eventMatch[1]}` : `/troop/${troopIdent}/events`);
                      } else if (location.pathname.includes('/billing')) {
                        navigate(`/troop/${troopIdent}/billing`);
                      }
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

      <div className="layout-content">
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
          
          <div style={{ flexGrow: 1 }}>
            {visibleNavLinks.map(link => {
              const IconComponent = link.icon;
              return (
                <Link 
                  key={link.path} 
                  to={link.path} 
                  style={linkStyle(link.path)} 
                  onClick={() => setMobileNavOpen(false)}
                >
                  {IconComponent && <IconComponent size={18} />}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
            <Link 
              to="/profile" 
              className="sidebar-user-profile"
              onClick={() => setMobileNavOpen(false)}
            >
              <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: '500', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {getDisplayName()}
              </p>
              {getFriendlyRole() && (
                <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.75rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {getFriendlyRole()}
                </p>
              )}
            </Link>
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
            <div style={{ textAlign: 'center', marginTop: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
              <Link 
                to="/privacy" 
                onClick={() => setMobileNavOpen(false)}
                style={{ 
                  color: 'var(--muted-foreground)', 
                  fontSize: '0.75rem', 
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  display: 'inline-block'
                }}
              >
                Privacy Policy
              </Link>
              <span style={{ color: 'var(--border-color)', fontSize: '0.75rem' }}>•</span>
              <Link 
                to="/terms" 
                onClick={() => setMobileNavOpen(false)}
                style={{ 
                  color: 'var(--muted-foreground)', 
                  fontSize: '0.75rem', 
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  display: 'inline-block'
                }}
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="layout-body">
          {/* Page Content */}
          <main className="layout-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

