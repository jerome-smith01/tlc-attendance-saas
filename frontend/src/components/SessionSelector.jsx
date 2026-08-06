import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { DataTable } from './common/DataTable';

export function SessionSelector({ troopId, onSessionSelect }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New session state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]); // Default today YYYY-MM-DD
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (troopId) {
      fetchSessions();
    }
  }, [troopId]);

  async function fetchSessions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('troop_id', troopId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession(e) {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;

    setCreating(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([
          {
            troop_id: troopId,
            event_name: newEventName.trim(),
            event_date: newEventDate
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setSessions([data, ...sessions]);
      setIsCreatingNew(false);
      setNewEventName('');
      onSessionSelect(data);
    } catch (err) {
      console.error('Error creating session:', err);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="glass-card" style={{ padding: '1rem' }}>Loading sessions...</div>;
  }

  const columns = [
    { key: 'event_name', label: 'Event Name' },
    { key: 'event_date', label: 'Date' },
    { 
      key: 'ended_at', 
      label: 'Status', 
      render: (val) => val ? <span className="badge badge-neutral">Ended</span> : <span className="badge badge-success">Active</span> 
    }
  ];

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Select Session</h2>
        {!isCreatingNew && (
          <button className="btn btn-primary" onClick={() => setIsCreatingNew(true)}>
            + New Session
          </button>
        )}
      </div>
      
      {error && <div style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>{error}</div>}

      {!isCreatingNew ? (
        <DataTable 
          columns={columns}
          data={sessions}
          storageKey="session_selector"
          onRowClick={(row) => onSessionSelect(row)}
        />
      ) : (
        <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Event Name:</label>
            <input 
              type="text" 
              placeholder="e.g. Regular Meeting" 
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--foreground)' }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Date:</label>
            <input 
              type="date" 
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--foreground)' }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" disabled={creating} className="btn btn-primary" style={{ flex: 1 }}>
              {creating ? 'Creating...' : 'Create Session'}
            </button>
            <button type="button" onClick={() => setIsCreatingNew(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
