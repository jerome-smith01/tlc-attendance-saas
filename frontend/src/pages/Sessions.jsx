import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';

export function Sessions() {
  const { selectedTroopId, selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedTroopId) {
      fetchSessions(selectedTroopId);
    } else {
      setSessions([]);
    }
  }, [selectedTroopId]);

  async function fetchSessions(troopId) {
    try {
      setLoading(true);
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('troop_id', troopId)
        .order('event_date', { ascending: false });
        
      if (!sessionsError) {
        setSessions(sessionsData || []);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteSession = async (sessionId) => {
    if (window.confirm("Are you sure you want to delete this session? This will also delete all associated scans and cannot be undone.")) {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (error) {
        alert("Error deleting session: " + error.message);
      } else {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    }
  };

  const handleReenableSession = async (sessionId) => {
    if (window.confirm("Are you sure you want to reenable this session?")) {
      const { error } = await supabase.from('sessions').update({ ended_at: null }).eq('id', sessionId);
      if (error) {
        alert("Error reenabling session: " + error.message);
      } else {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ended_at: null } : s));
      }
    }
  };

  if (loadingTroops) {
    return <div style={{ padding: '2rem' }}>Loading sessions...</div>;
  }

  if (!selectedTroopId) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>No Troop Selected</h2>
        <p>Please select a troop from the top navigation bar to view its sessions.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--foreground)' }}>Session History</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>
          Manage scanning sessions for Troop {selectedTroop?.troop_number}
        </p>
      </header>

      {loading ? (
        <p>Loading sessions...</p>
      ) : (
        <div style={{ border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '8px', backgroundColor: 'var(--glass-bg)' }}>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            A list of past scanning sessions. Synced sessions have had their detailed scan data securely purged from the server.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Event Name</th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Date</th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Synced By</th>
                {(isGlobalAdmin || selectedTroop?.currentUserRole === 'troop_admin' || selectedTroop?.currentUserRole === 'billing_admin') && (
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-primary)' }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No sessions found.</td>
                </tr>
              ) : (
                sessions.map(session => (
                  <tr key={session.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-primary)' }}>{session.event_name}</td>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-primary)' }}>{session.event_date}</td>
                    <td style={{ padding: '1rem 0.5rem' }}>
                      {session.synced_at 
                        ? <span style={{ color: 'var(--color-success)' }}>✅ Synced ({new Date(session.synced_at).toLocaleDateString()})</span>
                        : session.ended_at
                        ? <span style={{ color: 'var(--color-warning)' }}>🛑 Ended</span>
                        : <span style={{ color: 'var(--color-warning)' }}>⏳ Pending Sync</span>}
                    </td>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {session.synced_by ? 'User ' + session.synced_by.substring(0, 8) + '...' : '-'}
                    </td>
                    {(isGlobalAdmin || selectedTroop?.currentUserRole === 'troop_admin' || selectedTroop?.currentUserRole === 'billing_admin') && (
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                        {!session.synced_at && session.ended_at && (
                          <button
                            onClick={() => handleReenableSession(session.id)}
                            style={{ marginRight: '0.5rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                            title="Reenable Session"
                          >
                            Reenable
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteSession(session.id)}
                          style={{ padding: '0.4rem 0.75rem', backgroundColor: 'var(--color-error)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                          title="Delete Session"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
