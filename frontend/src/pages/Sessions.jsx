import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';
import { DataTable } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { useConfirm } from '../components/common/ConfirmContext';
import { useToast } from '../components/common/ToastContext';

export function Sessions() {
  const { selectedTroopId, selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();
  const [sessions, setSessions] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedSessionModal, setSelectedSessionModal] = useState(null);
  const [sessionAttendees, setSessionAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const confirm = useConfirm();
  const toast = useToast();

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
      toast('Error fetching sessions', 'error');
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
        data.forEach((scan, index) => {
          const key = scan.roster?.id || scan.id;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueList.push({
              index: index + 1,
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
    if (await confirm("Are you sure you want to delete this session? This will also delete all associated scans and cannot be undone.")) {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (error) {
        toast("Error deleting session: " + error.message, 'error');
      } else {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        toast('Session deleted', 'success');
      }
    }
  };

  const handleEndSession = async (sessionId) => {
    if (await confirm("Are you sure you want to end this session? This will approve all pending scans so they can be synced.")) {
      const now = new Date().toISOString();
      const { error: sessionError } = await supabase.from('sessions').update({ ended_at: now }).eq('id', sessionId);
      if (sessionError) {
        toast("Error ending session: " + sessionError.message, 'error');
        return;
      }
      
      const { error: scansError } = await supabase.from('scans').update({ status: 'approved' }).eq('session_id', sessionId).eq('status', 'pending');
      if (scansError) {
        toast("Error approving scans: " + scansError.message, 'error');
        return;
      }

      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ended_at: now } : s));
      toast('Session ended', 'success');
    }
  };

  const handleReenableSession = async (sessionId) => {
    if (await confirm("Are you sure you want to reenable this session?")) {
      const { error } = await supabase.from('sessions').update({ ended_at: null }).eq('id', sessionId);
      if (error) {
        toast("Error reenabling session: " + error.message, 'error');
      } else {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ended_at: null } : s));
        toast('Session reenabled', 'success');
      }
    }
  };

  const handleResetSyncSession = async (sessionId) => {
    if (await confirm("Are you sure you want to reset the sync status for this session? This will mark it as not synced so it can be synced again.")) {
      const { error } = await supabase
        .from('sessions')
        .update({ synced_at: null, synced_by: null, purge_after: null })
        .eq('id', sessionId);
      if (error) {
        toast("Error resetting sync status: " + error.message, 'error');
      } else {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, synced_at: null, synced_by: null, purge_after: null } : s));
        toast('Sync status reset', 'success');
      }
    }
  };

  const sessionColumns = [
    {
      label: 'Event Name',
      key: 'event_name',
      render: (val, session) => (
        <button
          onClick={() => handleViewAttendees(session)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
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
      )
    },
    {
      label: 'Date',
      key: 'event_date'
    },
    {
      label: 'Status',
      key: 'status', // Virtual accessor for sorting if needed
      render: (val, session) => {
        if (session.synced_at) return <span className="badge badge-success">✅ Synced ({new Date(session.synced_at).toLocaleDateString()})</span>;
        if (session.ended_at) return <span className="badge badge-error">🛑 Ended</span>;
        return <span className="badge badge-warning">⏳ Pending Sync</span>;
      }
    },
    {
      label: 'Synced By',
      key: 'synced_by',
      render: (val, session) => session.synced_by ? (usersMap[session.synced_by] || ('User ' + session.synced_by.substring(0, 8) + '...')) : '-'
    }
  ];

  if (isGlobalAdmin || selectedTroop?.currentUserRole === 'troop_admin' || selectedTroop?.currentUserRole === 'billing_admin') {
    sessionColumns.push({
      label: 'Actions',
      key: 'id',
      render: (val, session) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {session.synced_at && (
            <button
              onClick={() => handleResetSyncSession(session.id)}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              title="Reset Sync Status"
            >
              Reset Sync
            </button>
          )}
          {!session.synced_at && session.ended_at && (
            <button
              onClick={() => handleReenableSession(session.id)}
              className="btn btn-primary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              title="Reenable Session"
            >
              Reenable
            </button>
          )}
          {!session.synced_at && !session.ended_at && (
            <button
              onClick={() => handleEndSession(session.id)}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              title="End Session"
            >
              End
            </button>
          )}
          <button 
            onClick={() => handleDeleteSession(session.id)}
            className="btn btn-destructive"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            title="Delete Session"
          >
            Delete
          </button>
        </div>
      )
    });
  }

  const filteredAttendees = useMemo(() => {
    return sessionAttendees.filter(a => 
      a.name.toLowerCase().includes(attendeeSearch.toLowerCase()) || 
      a.memberId.toLowerCase().includes(attendeeSearch.toLowerCase())
    );
  }, [sessionAttendees, attendeeSearch]);

  const attendeeColumns = [
    { label: '#', key: 'index' },
    { label: 'Name', key: 'name' },
    { label: 'Member ID', key: 'memberId' },
    { label: 'Scan Time', key: 'time' }
  ];

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
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage scanning sessions for Troop {selectedTroop?.troop_number}
        </p>
      </header>

      {loading ? (
        <p>Loading sessions...</p>
      ) : (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            A list of past scanning sessions. Synced session data is automatically purged after 14 days.
          </p>
          <DataTable 
            data={sessions}
            columns={sessionColumns}
            keyField="id"
          />
        </div>
      )}

      {/* Attendee Details Modal */}
      <Modal
        isOpen={!!selectedSessionModal}
        onClose={() => setSelectedSessionModal(null)}
        title={selectedSessionModal?.event_name || 'Session Attendees'}
      >
        <p style={{ margin: '0.25rem 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Date: {selectedSessionModal?.event_date} &bull; Total Attendees: <strong>{sessionAttendees.length}</strong>
        </p>

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
                className="glass-card"
                style={{
                  width: '100%',
                  padding: '0.6rem 1rem',
                  border: '1px solid var(--border-color)',
                  color: 'var(--foreground)',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <DataTable 
              data={filteredAttendees}
              columns={attendeeColumns}
              keyField="id"
            />
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button onClick={() => setSelectedSessionModal(null)} className="btn btn-secondary">
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}

