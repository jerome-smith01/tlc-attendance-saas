import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    return <div style={{ padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: '8px', backgroundColor: 'var(--glass-bg)' }}>Loading sessions...</div>;
  }

  return (
    <div style={{ padding: '1.5rem', border: '1px solid var(--glass-border)', borderRadius: '8px', backgroundColor: 'var(--glass-bg)', marginBottom: '1.5rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Active Session</h2>
      
      {error && <div style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>{error}</div>}

      {!isCreatingNew ? (
        <div>
          <select 
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'NEW') {
                setIsCreatingNew(true);
              } else if (val) {
                const session = sessions.find(s => s.id === val);
                if (session) onSessionSelect(session);
              }
            }}
            defaultValue=""
            style={{ padding: '0.5rem', fontSize: '1rem', width: '100%', maxWidth: '400px', marginBottom: '1rem', display: 'block' }}
          >
            <option value="" disabled>Select a session to start scanning...</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.event_name} ({s.event_date}) {s.ended_at ? '(Ended)' : ''}
              </option>
            ))}
            <option value="NEW">+ Create New Session</option>
          </select>
        </div>
      ) : (
        <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Event Name:</label>
            <input 
              type="text" 
              placeholder="e.g. Regular Meeting" 
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Date:</label>
            <input 
              type="date" 
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" disabled={creating} style={{ flex: 1, padding: '0.5rem', backgroundColor: 'var(--color-primary)', color: 'white' }}>
              {creating ? 'Creating...' : 'Create Session'}
            </button>
            <button type="button" onClick={() => setIsCreatingNew(false)} style={{ padding: '0.5rem' }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
