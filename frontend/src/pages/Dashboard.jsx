import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';
import { formatAppDate } from '../utils/date';

export function Dashboard() {
  const { troopNumber } = useParams();
  const navigate = useNavigate();
  const { 
    selectedTroopId, 
    selectedTroop, 
    selectedTroopIdentifier, 
    selectTroopByNumberOrId, 
    loadingTroops, 
    error 
  } = useTroop();

  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [events, setEvents] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Sync TroopContext with URL parameter when troopNumber is present in URL
  useEffect(() => {
    if (loadingTroops) return;
    if (troopNumber) {
      selectTroopByNumberOrId(troopNumber);
    }
  }, [troopNumber, loadingTroops]);

  // If URL lacks troopNumber (legacy /dashboard), redirect to troop-scoped URL once troops are loaded
  useEffect(() => {
    if (loadingTroops || !selectedTroopIdentifier) return;
    if (!troopNumber) {
      navigate(`/troop/${selectedTroopIdentifier}/dashboard`, { replace: true });
    }
  }, [troopNumber, selectedTroopIdentifier, loadingTroops, navigate]);

  useEffect(() => {
    if (selectedTroopId) {
      fetchStats(selectedTroopId);
    } else {
      setActiveUsersCount(0);
      setEvents([]);
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

      // Fetch Events (for counts and warnings)
      let { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('troop_id', troopId)
        .order('event_date', { ascending: false });

      if (eventsError && (eventsError.code === '42P01' || eventsError.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .select('*')
          .eq('troop_id', troopId)
          .order('event_date', { ascending: false });
        eventsData = res.data;
        eventsError = res.error;
      }

      if (!eventsError) setEvents(eventsData || []);

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

      {error && <div style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>{error}</div>}

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
                <strong style={{ color: 'var(--text-secondary)' }}>Total Events:</strong> <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{loadingStats ? '...' : events.length}</span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, marginLeft: 'auto' }}>
                <Link to={selectedTroopIdentifier ? `/troop/${selectedTroopIdentifier}/events` : '/events'} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', textDecoration: 'none' }}>
                  View Events
                </Link>
              </div>
            </div>
          </div>

          {/* Event Warnings */}
          {events.map(eventObj => {
            if (eventObj.synced_at) return null; // Already synced, no warning

            const eventDate = new Date(eventObj.event_date);
            const now = new Date();
            const diffTime = Math.abs(now - eventDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const MAX_DAYS = 30;
            const daysLeft = MAX_DAYS - diffDays;

            // Only show warning when remaining days is 14 or less
            if (daysLeft > 14) return null;

            const isUrgent = daysLeft <= 7;
            const borderColor = isUrgent ? 'var(--color-error)' : 'var(--color-warning)';
            const labelColor = isUrgent ? 'var(--color-error)' : 'var(--color-warning)';
            const daysDisplay = daysLeft <= 0 ? 0 : daysLeft;

            return (
              <div
                key={eventObj.id}
                className="glass-card"
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  borderLeft: `4px solid ${borderColor}`
                }}
              >
                <strong style={{ color: labelColor }}>
                  {isUrgent ? 'Urgent Warning:' : 'Warning:'}
                </strong>{' '}
                Event "{eventObj.event_name}" ({formatAppDate(eventObj.event_date)}) has not been synced to TLC.{' '}
                {daysLeft <= 0
                  ? 'Data is overdue for auto-purge!'
                  : `Data will be automatically purged in ${daysDisplay} ${daysDisplay === 1 ? 'day' : 'days'}.`
                }
              </div>
            );
          })}

        </>
      )}
    </div>
  );
}
