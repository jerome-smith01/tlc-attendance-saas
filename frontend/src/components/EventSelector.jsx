import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { DataTable } from './common/DataTable';

export function EventSelector({ troopId, onEventSelect }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New event state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]); // Default today YYYY-MM-DD
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (troopId) {
      fetchEvents();
    }
  }, [troopId]);

  async function fetchEvents() {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('troop_id', troopId)
        .order('event_date', { ascending: false });

      // Fallback for pre-migration table name
      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .select('*')
          .eq('troop_id', troopId)
          .order('event_date', { ascending: false });
        data = res.data;
        error = res.error;
      }

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;

    setCreating(true);
    setError(null);
    try {
      let { data, error } = await supabase
        .from('events')
        .insert([
          {
            troop_id: troopId,
            event_name: newEventName.trim(),
            event_date: newEventDate
          }
        ])
        .select()
        .single();

      // Fallback for pre-migration table name
      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase
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
        data = res.data;
        error = res.error;
      }

      if (error) throw error;

      setEvents([data, ...events]);
      setIsCreatingNew(false);
      setNewEventName('');
      onEventSelect(data);
    } catch (err) {
      console.error('Error creating event:', err);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="glass-card" style={{ padding: '1rem' }}>Loading events...</div>;
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
        <h2 style={{ margin: 0 }}>Select Event</h2>
        {!isCreatingNew && (
          <button className="btn btn-start" onClick={() => setIsCreatingNew(true)}>
            + New Event
          </button>
        )}
      </div>
      
      {error && <div style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>{error}</div>}

      {!isCreatingNew ? (
        <DataTable 
          columns={columns}
          data={events}
          storageKey="event_selector"
          onRowClick={(row) => onEventSelect(row)}
        />
      ) : (
        <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
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
            <button type="submit" disabled={creating} className="btn btn-start" style={{ flex: 1 }}>
              {creating ? 'Creating...' : 'Create Event'}
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

// Export SessionSelector as alias for backward compatibility
export const SessionSelector = EventSelector;
