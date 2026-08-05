import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';

export function Sessions() {
  const { selectedTroopId, selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();
  const [sessions, setSessions] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedSessionModal, setSelectedSessionModal] = useState(null);
  const [sessionAttendees, setSessionAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  useEffect(() => {
    if (selectedTroopId) {
      fetchSessions(selectedTroopId);
    } else {
      setSessions([]);
      setUsersMap({});
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
        
      if (!sessionsError && sessionsData) {
        setSessions(sessionsData);

        const userIds = [...new Set(sessionsData.map(s => s.synced_by).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: rosterData } = await supabase
            .from('roster')
            .select('user_id, first_name, last_initial')
            .in('user_id', userIds);

          if (rosterData) {
            const map = {};
            rosterData.forEach(r => {
              if (r.user_id && r.first_name) {
                const initial = r.last_initial
                  ? (r.last_initial.endsWith('.') ? r.last_initial : `${r.last_initial}.`)
                  : '';
                map[r.user_id] = `${r.first_name} ${initial}`.trim();
              }
            });
            setUsersMap(map);
          }
        } else {
          setUsersMap({});
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleViewAttendees = async (session) => {
    setSelectedSessionModal(session);
    setLoadingAttendees(true);
    setAttendeeSearch('');
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('id, created_at, status, roster(id, first_name, last_initial, member_id, tlc_id)')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const seen = new Set();
        const uniqueList = [];
        data.forEach(scan => {
          const key = scan.roster?.id || scan.id;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueList.push({
              id: scan.id,
              name: scan.roster ? `${scan.roster.first_name} ${scan.roster.last_initial || ''}`.trim() : 'Unknown Member',
              memberId: scan.roster?.member_id || scan.roster?.tlc_id || '-',
              time: scan.created_at ? new Date(scan.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-',
              status: scan.status
            });
          }
        });
        setSessionAttendees(uniqueList);
      } else {
        setSessionAttendees([]);
      }
    } catch (err) {
      console.error('Error fetching session attendees:', err);
      setSessionAttendees([]);
    } finally {
      setLoadingAttendees(false);
    }
  };

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

  const handleEndSession = async (sessionId) => {
    if (window.confirm("Are you sure you want to end this session? This will approve all pending scans so they can be synced.")) {
      const now = new Date().toISOString();
      const { error: sessionError } = await supabase.from('sessions').update({ ended_at: now }).eq('id', sessionId);
      if (sessionError) {
        alert("Error ending session: " + sessionError.message);
        return;
      }
      
      const { error: scansError } = await supabase.from('scans').update({ status: 'approved' }).eq('session_id', sessionId).eq('status', 'pending');
      if (scansError) {
        alert("Error approving scans: " + scansError.message);
        return;
      }

      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ended_at: now } : s));
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

  const handleResetSyncSession = async (sessionId) => {
    if (window.confirm("Are you sure you want to reset the sync status for this session? This will mark it as not synced so it can be synced again.")) {
      const { error } = await supabase
        .from('sessions')
        .update({ synced_at: null, synced_by: null, purge_after: null })
        .eq('id', sessionId);
      if (error) {
        alert("Error resetting sync status: " + error.message);
      } else {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, synced_at: null, synced_by: null, purge_after: null } : s));
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
            A list of past scanning sessions. Synced session data is automatically purged after 14 days.
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
                    <td style={{ padding: '1rem 0.5rem' }}>
                      <button
                        onClick={() => handleViewAttendees(session)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary, #0066cc)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          font: 'inherit',
                          fontWeight: '600',
                          textAlign: 'left',
                          padding: 0
                        }}
                        title="Click to view attendees"
                      >
                        {session.event_name}
                      </button>
                    </td>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-primary)' }}>{session.event_date}</td>
                    <td style={{ padding: '1rem 0.5rem' }}>
                      {session.synced_at 
                        ? <span style={{ color: 'var(--color-success)' }}>✅ Synced ({new Date(session.synced_at).toLocaleDateString()})</span>
                        : session.ended_at
                        ? <span style={{ color: 'var(--color-warning)' }}>🛑 Ended</span>
                        : <span style={{ color: 'var(--color-warning)' }}>⏳ Pending Sync</span>}
                    </td>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {session.synced_by ? (usersMap[session.synced_by] || ('User ' + session.synced_by.substring(0, 8) + '...')) : '-'}
                    </td>
                    {(isGlobalAdmin || selectedTroop?.currentUserRole === 'troop_admin' || selectedTroop?.currentUserRole === 'billing_admin') && (
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                        {session.synced_at && (
                          <button
                            onClick={() => handleResetSyncSession(session.id)}
                            style={{ marginRight: '0.5rem', padding: '0.4rem 0.75rem', backgroundColor: '#eab308', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                            title="Reset Sync Status"
                          >
                            Reset Sync
                          </button>
                        )}
                        {!session.synced_at && session.ended_at && (
                          <button
                            onClick={() => handleReenableSession(session.id)}
                            style={{ marginRight: '0.5rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                            title="Reenable Session"
                          >
                            Reenable
                          </button>
                        )}
                        {!session.synced_at && !session.ended_at && (
                          <button
                            onClick={() => handleEndSession(session.id)}
                            style={{ marginRight: '0.5rem', padding: '0.4rem 0.75rem', backgroundColor: '#eab308', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                            title="End Session"
                          >
                            End
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

      {/* Attendee Details Modal */}
      {selectedSessionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setSelectedSessionModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--background)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1.4rem' }}>{selectedSessionModal.event_name}</h2>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                  Date: {selectedSessionModal.event_date} &bull; Total Attendees: <strong>{sessionAttendees.length}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedSessionModal(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)',
                  lineHeight: 1
                }}
                title="Close"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {loadingAttendees ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading attendees...</p>
              ) : sessionAttendees.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No attendees recorded for this session.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <input
                      type="text"
                      placeholder="Search attendees..."
                      value={attendeeSearch}
                      onChange={e => setAttendeeSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 1rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--glass-bg)',
                        color: 'var(--foreground)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)' }}>
                        <th style={{ padding: '0.6rem 0.5rem', width: '40px' }}>#</th>
                        <th style={{ padding: '0.6rem 0.5rem' }}>Name</th>
                        <th style={{ padding: '0.6rem 0.5rem' }}>Member ID</th>
                        <th style={{ padding: '0.6rem 0.5rem' }}>Scan Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionAttendees
                        .filter(a => a.name.toLowerCase().includes(attendeeSearch.toLowerCase()) || a.memberId.toLowerCase().includes(attendeeSearch.toLowerCase()))
                        .map((attendee, index) => (
                          <tr key={attendee.id || index} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>{index + 1}</td>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{attendee.name}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{attendee.memberId}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>{attendee.time}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedSessionModal(null)}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: 'var(--color-primary, #0066cc)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
