import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { RosterList } from '../components/RosterList';
import { InviteUser } from '../components/InviteUser';
import { ThemeToggle } from '../components/ThemeToggle';

export function Dashboard() {
  const { signOut, user } = useAuth();
  const [troops, setTroops] = useState([]);
  const [selectedTroopId, setSelectedTroopId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  // Stats
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetchTroops();
  }, [user]);

  useEffect(() => {
    if (selectedTroopId) {
      // Save to localStorage so it remembers the selection
      localStorage.setItem('tlc_last_troop_id', selectedTroopId);
      
      // Fetch stats for the selected troop
      fetchStats(selectedTroopId);
    }
  }, [selectedTroopId]);

  async function fetchTroops() {
    try {
      setLoading(true);
      
      // We first check if the user is a global_admin
      const { data: globalAdminData, error: globalAdminError } = await supabase
        .from('global_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (globalAdminData) {
        setIsGlobalAdmin(true);
        // Global admin: fetch all troops
        const { data: allTroops, error: troopsError } = await supabase
          .from('troops')
          .select('id, troop_number');
          
        if (troopsError) throw troopsError;
        setTroops(allTroops || []);
        setDefaultTroop(allTroops || []);
        return;
      }

      // Normal user: fetch only troops they are linked to via troop_users
      const { data, error } = await supabase
        .from('troop_users')
        .select(`
          troop_id,
          role,
          onboarding_completed,
          troops (
            troop_number
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // If any of their memberships have incomplete onboarding, force them to complete it
      const needsOnboarding = data?.some(tu => tu.onboarding_completed === false);
      if (needsOnboarding) {
        window.location.hash = '#/complete-profile';
        return;
      }
      
      const formattedTroops = (data || []).map(tu => ({
        id: tu.troop_id,
        troop_number: tu.troops.troop_number,
        currentUserRole: tu.role
      }));
      
      setTroops(formattedTroops);
      setDefaultTroop(formattedTroops);
      
    } catch (err) {
      console.error('Error fetching troops:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setDefaultTroop(availableTroops) {
    if (availableTroops.length === 0) return;
    
    const saved = localStorage.getItem('tlc_last_troop_id');
    if (saved && availableTroops.find(t => t.id === saved)) {
      setSelectedTroopId(saved);
    } else {
      setSelectedTroopId(availableTroops[0].id);
    }
  }

  async function fetchStats(troopId) {
    try {
      // Fetch Active Users Count (users in this troop)
      const { count: usersCount, error: usersError } = await supabase
        .from('troop_users')
        .select('*', { count: 'exact', head: true })
        .eq('troop_id', troopId);
        
      if (!usersError) setActiveUsersCount(usersCount || 0);

      // Fetch Sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('troop_id', troopId)
        .order('event_date', { ascending: false });
        
      if (!sessionsError) setSessions(sessionsData || []);

    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  const selectedTroop = troops.find(t => t.id === selectedTroopId);

  return (
    <div style={{ padding: '2rem', color: 'var(--foreground)', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--foreground)' }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--muted-foreground)' }}>{user?.email}</span>
          <ThemeToggle />
          <button onClick={signOut} style={{ padding: '0.5rem 1rem' }}>Sign Out</button>
        </div>
      </header>

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p>Loading your profile...</p>
      ) : troops.length === 0 ? (
        <div style={{ padding: '2rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <h2>No Troops Found</h2>
          <p>You don't currently have access to any troops. Please ask your administrator for an invite.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
            <label htmlFor="troop-select" style={{ fontWeight: 'bold', marginRight: '1rem' }}>Active Troop Context:</label>
            <select 
              id="troop-select"
              value={selectedTroopId}
              onChange={e => setSelectedTroopId(e.target.value)}
              style={{ padding: '0.5rem', fontSize: '1rem', minWidth: '200px' }}
            >
              {troops.map(t => (
                <option key={t.id} value={t.id}>{t.troop_number}</option>
              ))}
            </select>
            
            <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem' }}>
              <div>
                <strong>Active Users (Backend Access):</strong> {activeUsersCount}
              </div>
              <div>
                <strong>Total Sessions:</strong> {sessions.length}
              </div>
            </div>
          </div>

          {/* Session Warnings */}
          {sessions.map(session => {
            if (session.synced_at) return null; // Already synced, no warning

            const sessionDate = new Date(session.event_date);
            const now = new Date();
            const diffTime = Math.abs(now - sessionDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            // Assuming we purge after 30 days
            const MAX_DAYS = 30;
            const daysLeft = MAX_DAYS - diffDays;

            if (daysLeft <= 0) return null; // Already past purge time or edge case

            return (
              <div key={session.id} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', borderLeft: '4px solid #ffeeba' }}>
                <strong>Warning:</strong> Session "{session.event_name}" ({session.event_date}) has not been synced to TLC. 
                Data will be automatically purged in {daysLeft} days.
              </div>
            );
          })}

          {selectedTroopId && (
            <>
              <InviteUser troopId={selectedTroopId} />
              <RosterList 
                troopId={selectedTroopId} 
                currentUserRole={selectedTroop?.currentUserRole}
                currentUserId={user?.id}
                isGlobalAdmin={isGlobalAdmin}
              />
              
              {/* Session History View */}
              <div style={{ marginTop: '2rem', border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', backgroundColor: 'var(--glass-bg)' }}>
                <h2>Session History</h2>
                <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                  A list of past scanning sessions. Synced sessions have had their detailed scan data securely purged from the server.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Event Name</th>
                      <th style={{ padding: '0.5rem' }}>Date</th>
                      <th style={{ padding: '0.5rem' }}>Status</th>
                      <th style={{ padding: '0.5rem' }}>Synced By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>No sessions found.</td>
                      </tr>
                    ) : (
                      sessions.map(session => (
                        <tr key={session.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          <td style={{ padding: '0.5rem' }}>{session.event_name}</td>
                          <td style={{ padding: '0.5rem' }}>{session.event_date}</td>
                          <td style={{ padding: '0.5rem' }}>
                            {session.synced_at 
                              ? <span style={{ color: 'var(--color-success)' }}>✅ Synced ({new Date(session.synced_at).toLocaleDateString()})</span>
                              : <span style={{ color: 'var(--color-warning)' }}>⏳ Pending Sync</span>}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {session.synced_by ? 'User ' + session.synced_by.substring(0, 8) + '...' : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
