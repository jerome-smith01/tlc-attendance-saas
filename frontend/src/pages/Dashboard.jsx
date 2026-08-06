import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { selectedTroopId, selectedTroop, loadingTroops, error } = useTroop();
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (selectedTroopId) {
      fetchStats(selectedTroopId);
    } else {
      setActiveUsersCount(0);
      setSessions([]);
    }
  }, [selectedTroopId]);

  async function fetchStats(troopId) {
    try {
      setLoadingStats(true);
      // Fetch Active Users Count (users in this troop)
      const { count: usersCount, error: usersError } = await supabase
        .from('troop_users')
        .select('*', { count: 'exact', head: true })
        .eq('troop_id', troopId);
        
      if (!usersError) setActiveUsersCount(usersCount || 0);

      // Fetch Sessions (for counts and warnings)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('troop_id', troopId)
        .order('event_date', { ascending: false });
        
      if (!sessionsError) setSessions(sessionsData || []);

    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }

  if (loadingTroops) {
    return <div style={{ padding: '2rem' }}>Loading Dashboard...</div>;
  }

  return (
    <div style={{ padding: 'clamp(1rem, 5vw, 2rem)', color: 'var(--foreground)', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--foreground)' }}>Dashboard</h1>
      </header>

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      {!selectedTroopId ? (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h2>No Troops Found</h2>
          <p>You don't currently have access to any troops. Please ask your administrator for an invite.</p>
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ marginBottom: '2rem', padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
            <h2 style={{ marginTop: 0 }}>Troop {selectedTroop?.troop_number} Overview</h2>
            
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem 2rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Active Users (Backend Access):</strong> <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{loadingStats ? '...' : activeUsersCount}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Total Sessions:</strong> <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{loadingStats ? '...' : sessions.length}</span>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, marginLeft: 'auto' }}>
                <Link to="/scanner" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', textDecoration: 'none' }}>
                  Launch Scanner
                </Link>
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
              <div key={session.id} className="glass-card" style={{ marginBottom: '1rem', padding: '1rem', borderLeft: '4px solid var(--color-warning)' }}>
                <strong style={{ color: 'var(--color-warning)' }}>Warning:</strong> Session "{session.event_name}" ({session.event_date}) has not been synced to TLC. 
                Data will be automatically purged in {daysLeft} days.
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
