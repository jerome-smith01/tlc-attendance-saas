import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';
import { useAuth } from '../context/AuthContext';
import { DataTable } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { FilterPopover } from '../components/common/FilterPopover';
import { useConfirm } from '../components/common/ConfirmContext';
import { useToast } from '../components/common/ToastContext';

export function Events() {
  const { selectedTroopId, selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();
  const { session: authSession } = useAuth();
  const userId = authSession?.user?.id || 'anonymous';
  const storageKey = `tlc_events_filters_${userId}`;

  const [events, setEvents] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedEventModal, setSelectedEventModal] = useState(null);
  const [eventAttendees, setEventAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  // Row selection state for bulk actions
  const [selectedEventIds, setSelectedEventIds] = useState([]);

  // Start new event states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Search & Filter & Sort states
  const [eventSearch, setEventSearch] = useState('');
  const [activePopover, setActivePopover] = useState(null); // 'event_name' | 'event_date' | 'status' | 'synced_by'
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const defaultFilters = {
    event_name: [],
    event_date: { from: '', to: '' },
    status: [],
    synced_by: []
  };

  const defaultSort = { key: null, direction: 'asc' };

  const [sortConfig, setSortConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sortConfig) return parsed.sortConfig;
      }
    } catch (e) {
      console.warn('Failed to load saved sort config', e);
    }
    return defaultSort;
  });

  const [columnFilters, setColumnFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.columnFilters) {
          const loaded = { ...defaultFilters, ...parsed.columnFilters };
          if (typeof loaded.event_name === 'string') {
            loaded.event_name = loaded.event_name ? [loaded.event_name] : [];
          }
          return loaded;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved column filters', e);
    }
    return defaultFilters;
  });

  // Save sort and filter state on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sortConfig, columnFilters }));
    } catch (e) {
      console.warn('Failed to persist table state', e);
    }
  }, [sortConfig, columnFilters, storageKey]);

  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    if (selectedTroopId) {
      fetchEvents(selectedTroopId);
    } else {
      setEvents([]);
      setUsersMap({});
      setSelectedEventIds([]);
    }
  }, [selectedTroopId]);

  async function fetchEvents(troopId) {
    try {
      setLoading(true);
      let { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('troop_id', troopId)
        .order('event_date', { ascending: false });

      // Fallback for pre-migration DB
      if (eventsError && (eventsError.code === '42P01' || eventsError.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .select('*')
          .eq('troop_id', troopId)
          .order('event_date', { ascending: false });
        eventsData = res.data;
        eventsError = res.error;
      }
        
      if (!eventsError && eventsData) {
        setEvents(eventsData);

        const userIds = [...new Set(eventsData.map(s => s.synced_by).filter(Boolean))];
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
      console.error('Error fetching events:', err);
      toast('Error fetching events', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleViewAttendees = async (eventObj) => {
    setSelectedEventModal(eventObj);
    setLoadingAttendees(true);
    setAttendeeSearch('');
    try {
      let { data, error } = await supabase
        .from('scans')
        .select('id, scan_time, status, roster(id, first_name, last_initial, member_id, tlc_id)')
        .eq('event_id', eventObj.id)
        .order('scan_time', { ascending: true });

      // Fallback for pre-migration scans FK
      if (error && error.message.includes('event_id')) {
        const res = await supabase
          .from('scans')
          .select('id, scan_time, status, roster(id, first_name, last_initial, member_id, tlc_id)')
          .eq('session_id', eventObj.id)
          .order('scan_time', { ascending: true });
        data = res.data;
        error = res.error;
      }

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
              time: scan.scan_time ? new Date(scan.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-',
              status: scan.status
            });
          }
        });
        setEventAttendees(uniqueList);
      } else {
        setEventAttendees([]);
      }
    } catch (err) {
      console.error('Error fetching event attendees:', err);
      setEventAttendees([]);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;

    setCreatingEvent(true);
    try {
      let { data, error } = await supabase
        .from('events')
        .insert([
          {
            troop_id: selectedTroopId,
            event_name: newEventName.trim(),
            event_date: newEventDate
          }
        ])
        .select()
        .single();

      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .insert([
            {
              troop_id: selectedTroopId,
              event_name: newEventName.trim(),
              event_date: newEventDate
            }
          ])
          .select()
          .single();
        data = res.data;
        error = res.error;
      }

      if (error) {
        toast('Error creating event: ' + error.message, 'error');
      } else {
        setEvents(prev => [data, ...prev]);
        setIsCreateModalOpen(false);
        setNewEventName('');
        toast('Event created successfully', 'success');
      }
    } catch (err) {
      console.error('Error creating event:', err);
      toast('Error creating event', 'error');
    } finally {
      setCreatingEvent(false);
    }
  };

  const getStatusLabel = (eventObj) => {
    if (eventObj.synced_at) return 'Synced';
    if (eventObj.ended_at) return 'Closed';
    return 'Open';
  };

  const getStatusBadgeClass = (eventObj) => {
    if (eventObj.synced_at) return 'badge-neutral';
    if (eventObj.ended_at) return 'badge-warning';
    return 'badge-success';
  };

  // Compute unique values for popovers
  const uniqueNames = useMemo(() => {
    const names = events.map(s => s.event_name).filter(Boolean);
    return [...new Set(names)].sort();
  }, [events]);

  const uniqueSyncedBy = useMemo(() => {
    const ids = events.map(s => s.synced_by).filter(Boolean);
    const uniqueIds = [...new Set(ids)];
    return uniqueIds.map(id => ({
      id,
      name: usersMap[id] || id
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [events, usersMap]);

  // Filter & Sort Logic
  const processedEvents = useMemo(() => {
    let result = [...events];

    // Global Search
    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase().trim();
      result = result.filter(s => {
        const nameMatch = (s.event_name || '').toLowerCase().includes(q);
        const dateMatch = (s.event_date || '').toLowerCase().includes(q);
        const statusMatch = getStatusLabel(s).toLowerCase().includes(q);
        const syncedByMatch = (usersMap[s.synced_by] || '').toLowerCase().includes(q);
        return nameMatch || dateMatch || statusMatch || syncedByMatch;
      });
    }

    // Column Filters
    if (columnFilters.event_name && columnFilters.event_name.length > 0) {
      result = result.filter(s => columnFilters.event_name.includes(s.event_name));
    }

    if (columnFilters.event_date?.from) {
      result = result.filter(s => s.event_date >= columnFilters.event_date.from);
    }

    if (columnFilters.event_date?.to) {
      result = result.filter(s => s.event_date <= columnFilters.event_date.to);
    }

    if (columnFilters.status && columnFilters.status.length > 0) {
      result = result.filter(s => columnFilters.status.includes(getStatusLabel(s)));
    }

    if (columnFilters.synced_by && columnFilters.synced_by.length > 0) {
      result = result.filter(s => {
        if (!s.synced_by) return false;
        const name = usersMap[s.synced_by] || s.synced_by;
        return columnFilters.synced_by.includes(name);
      });
    }

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA, valB;

        if (sortConfig.key === 'status') {
          valA = getStatusLabel(a);
          valB = getStatusLabel(b);
        } else if (sortConfig.key === 'synced_by') {
          valA = usersMap[a.synced_by] || a.synced_by || '';
          valB = usersMap[b.synced_by] || b.synced_by || '';
        } else {
          valA = a[sortConfig.key] || '';
          valB = b[sortConfig.key] || '';
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [events, eventSearch, columnFilters, sortConfig, usersMap]);

  // Master Checkbox state logic
  const isAllSelected = useMemo(() => {
    if (processedEvents.length === 0) return false;
    return processedEvents.every(s => selectedEventIds.includes(s.id));
  }, [processedEvents, selectedEventIds]);

  const isSomeSelected = useMemo(() => {
    if (processedEvents.length === 0) return false;
    return processedEvents.some(s => selectedEventIds.includes(s.id)) && !isAllSelected;
  }, [processedEvents, selectedEventIds, isAllSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEventIds([]);
    } else {
      setSelectedEventIds(processedEvents.map(s => s.id));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedEventIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Admin / Leader check
  const currentUserRole = selectedTroop?.user_role;
  const canManage = isGlobalAdmin || currentUserRole === 'billing_admin' || currentUserRole === 'troop_admin';

  // Selected events list & Action Enablement Rules
  const selectedEventsList = useMemo(() => {
    return events.filter(s => selectedEventIds.includes(s.id));
  }, [events, selectedEventIds]);

  const canBulkClose = useMemo(() => {
    if (selectedEventsList.length === 0) return false;
    // 'Close' is valid ONLY if ALL selected events are open (not synced and not ended)
    return selectedEventsList.every(s => !s.synced_at && !s.ended_at);
  }, [selectedEventsList]);

  const canBulkReopen = useMemo(() => {
    if (selectedEventsList.length === 0) return false;
    // 'Reopen' is valid ONLY if ALL selected events are ended and not synced
    return selectedEventsList.every(s => !s.synced_at && s.ended_at);
  }, [selectedEventsList]);

  const canBulkResetSync = useMemo(() => {
    if (selectedEventsList.length === 0) return false;
    // 'Reset Sync' is valid ONLY if ALL selected events are synced
    return selectedEventsList.every(s => s.synced_at);
  }, [selectedEventsList]);

  const canBulkDelete = useMemo(() => {
    return selectedEventsList.length > 0 && canManage;
  }, [selectedEventsList, canManage]);

  // Bulk Action Execution Handlers
  const handleBulkClose = async () => {
    if (!canBulkClose) return;
    const count = selectedEventsList.length;
    if (await confirm(`Are you sure you want to close ${count} selected event(s)? This will approve all pending scans for these events.`)) {
      const now = new Date().toISOString();
      const ids = selectedEventsList.map(s => s.id);

      let { error: eventError } = await supabase
        .from('events')
        .update({ ended_at: now })
        .in('id', ids);

      if (eventError && (eventError.code === '42P01' || eventError.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .update({ ended_at: now })
          .in('id', ids);
        eventError = res.error;
      }

      if (eventError) {
        toast("Error closing events: " + eventError.message, 'error');
        return;
      }

      let { error: scansError } = await supabase
        .from('scans')
        .update({ status: 'approved' })
        .in('event_id', ids)
        .eq('status', 'pending');

      if (scansError && scansError.message.includes('event_id')) {
        const res = await supabase
          .from('scans')
          .update({ status: 'approved' })
          .in('session_id', ids)
          .eq('status', 'pending');
        scansError = res.error;
      }

      if (scansError) {
        toast("Error approving scans: " + scansError.message, 'error');
        return;
      }

      setEvents(prev => prev.map(s => ids.includes(s.id) ? { ...s, ended_at: now } : s));
      toast(`${count} event(s) closed`, 'success');
    }
  };

  const handleBulkReopen = async () => {
    if (!canBulkReopen) return;
    const count = selectedEventsList.length;
    if (await confirm(`Are you sure you want to reopen ${count} selected event(s)?`)) {
      const ids = selectedEventsList.map(s => s.id);
      let { error } = await supabase
        .from('events')
        .update({ ended_at: null })
        .in('id', ids);

      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .update({ ended_at: null })
          .in('id', ids);
        error = res.error;
      }

      if (error) {
        toast("Error reopening events: " + error.message, 'error');
      } else {
        setEvents(prev => prev.map(s => ids.includes(s.id) ? { ...s, ended_at: null } : s));
        toast(`${count} event(s) reopened`, 'success');
      }
    }
  };

  const handleBulkResetSync = async () => {
    if (!canBulkResetSync) return;
    const count = selectedEventsList.length;
    if (await confirm(`Are you sure you want to reset sync status for ${count} selected event(s)?`)) {
      const ids = selectedEventsList.map(s => s.id);
      let { error } = await supabase
        .from('events')
        .update({ synced_at: null, synced_by: null, purge_after: null })
        .in('id', ids);

      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .update({ synced_at: null, synced_by: null, purge_after: null })
          .in('id', ids);
        error = res.error;
      }

      if (error) {
        toast("Error resetting sync status: " + error.message, 'error');
      } else {
        setEvents(prev => prev.map(s => ids.includes(s.id) ? { ...s, synced_at: null, synced_by: null, purge_after: null } : s));
        toast(`Sync status reset for ${count} event(s)`, 'success');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (!canBulkDelete) return;
    const count = selectedEventsList.length;
    if (await confirm(`Are you sure you want to delete ${count} selected event(s)? This will also delete all associated scans and cannot be undone.`)) {
      const ids = selectedEventsList.map(s => s.id);
      let { error } = await supabase.from('events').delete().in('id', ids);

      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase.from('sessions').delete().in('id', ids);
        error = res.error;
      }

      if (error) {
        toast("Error deleting events: " + error.message, 'error');
      } else {
        setEvents(prev => prev.filter(s => !ids.includes(s.id)));
        setSelectedEventIds([]);
        toast(`${count} event(s) deleted`, 'success');
      }
    }
  };

  // Single-row: Reset Sync
  const handleResetSyncEvent = async (eventId) => {
    if (await confirm('Reset sync status for this event? It will be marked as unsynced and can be synced again.')) {
      const { error } = await supabase
        .from('events')
        .update({ synced_at: null, synced_by: null, purge_after: null })
        .eq('id', eventId);
      if (error) {
        toast('Error resetting sync: ' + error.message, 'error');
      } else {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, synced_at: null, synced_by: null, purge_after: null } : e));
        toast('Sync status reset', 'success');
      }
    }
  };

  // Single-row: Delete
  const handleDeleteEvent = async (eventId) => {
    if (await confirm('Delete this event? This will also delete all associated scans and cannot be undone.')) {
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) {
        toast('Error deleting event: ' + error.message, 'error');
      } else {
        setEvents(prev => prev.filter(e => e.id !== eventId));
        toast('Event deleted', 'success');
      }
    }
  };

  // Sort Handler
  const handleSortToggle = (key) => {
    setSortConfig(prev => {
      if (prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key: null, direction: 'asc' };
    });
  };

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips = [];

    if (columnFilters.event_name && columnFilters.event_name.length > 0) {
      chips.push({
        id: 'event_name',
        label: `Name: ${columnFilters.event_name.join(', ')}`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, event_name: [] }))
      });
    }

    if (columnFilters.event_date?.from || columnFilters.event_date?.to) {
      let text = 'Date: ';
      if (columnFilters.event_date.from && columnFilters.event_date.to) {
        text += `${columnFilters.event_date.from} to ${columnFilters.event_date.to}`;
      } else if (columnFilters.event_date.from) {
        text += `From ${columnFilters.event_date.from}`;
      } else {
        text += `Until ${columnFilters.event_date.to}`;
      }
      chips.push({
        id: 'event_date',
        label: text,
        onRemove: () => setColumnFilters(prev => ({ ...prev, event_date: { from: '', to: '' } }))
      });
    }

    if (columnFilters.status && columnFilters.status.length > 0) {
      chips.push({
        id: 'status',
        label: `Status: ${columnFilters.status.join(', ')}`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, status: [] }))
      });
    }

    if (columnFilters.synced_by && columnFilters.synced_by.length > 0) {
      chips.push({
        id: 'synced_by',
        label: `Synced By: ${columnFilters.synced_by.join(', ')}`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, synced_by: [] }))
      });
    }

    return chips;
  }, [columnFilters]);

  const handleClearAll = () => {
    setColumnFilters(defaultFilters);
    setSortConfig(defaultSort);
    setEventSearch('');
  };

  const filteredAttendees = useMemo(() => {
    if (!attendeeSearch.trim()) return eventAttendees;
    const q = attendeeSearch.toLowerCase().trim();
    return eventAttendees.filter(a =>
      a.name.toLowerCase().includes(q) || a.memberId.toLowerCase().includes(q)
    );
  }, [eventAttendees, attendeeSearch]);

  const attendeeColumns = [
    { key: 'index', label: '#' },
    { key: 'name', label: 'Member Name' },
    { key: 'memberId', label: 'Member ID / TLC ID' },
    { key: 'time', label: 'Scan Time' },
    { 
      key: 'status', 
      label: 'Status',
      render: (val) => (
        <span className={`badge ${val === 'approved' ? 'badge-success' : val === 'complete' ? 'badge-approved' : 'badge-warning'}`}>
          {val || 'pending'}
        </span>
      )
    }
  ];

  if (!selectedTroopId) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 className="app-title" style={{ marginBottom: '1.5rem' }}>Events</h1>
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Please select a troop from the sidebar to view events.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Bar / Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="app-title" style={{ margin: 0 }}>Events</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {selectedTroop ? `Troop ${selectedTroop.troop_number}` : ''}
          </p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-start"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
        >
          + Start New Event
        </button>
      </header>

      {loading ? (
        <p>Loading events...</p>
      ) : (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            A list of past scanning events. Synced event data is automatically purged after 30 days.
          </p>

          {/* Search, Mobile Filter Toggle, Clear All Filter Toolbar */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search events (name, date, status, synced by)..."
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem 0.625rem 2.25rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--foreground)',
                  fontSize: '0.875rem'
                }}
              />
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none', fontSize: '0.9rem' }}>
                🔍
              </span>
            </div>

            {/* Mobile Filter Button */}
            <button
              type="button"
              className="btn btn-secondary filter-mobile-btn"
              onClick={() => setIsMobileSheetOpen(true)}
              style={{ display: 'none' }}
            >
              🌪️ Filter & Sort {(activeChips.length > 0 || sortConfig.key) && `(${activeChips.length + (sortConfig.key ? 1 : 0)})`}
            </button>

            {/* Clear All Filters button */}
            {(activeChips.length > 0 || sortConfig.key || eventSearch) && (
              <button
                type="button"
                className="btn-link"
                onClick={handleClearAll}
                style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Active Filter Chips */}
          {activeChips.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Active Filters:
              </span>
              {activeChips.map(chip => (
                <div
                  key={chip.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--muted)',
                    color: 'var(--foreground)',
                    fontSize: '0.8rem',
                    fontWeight: 500
                  }}
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      lineHeight: 1,
                      padding: 0
                    }}
                    title="Remove filter"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Responsive Grid Morph Table */}
          <div className="grid-table-container">
            {/* Table Header (Desktop Only) */}
            <div className="grid-table-header" style={{ gridTemplateColumns: canManage ? '1.5fr 1fr 1fr 1fr 1.5fr' : '1.5fr 1fr 1fr 1fr' }} role="row">

              {/* Event Name Header */}
              <div role="columnheader" className="column-header-cell">
                <button type="button" className="column-header-btn" onClick={() => handleSortToggle('event_name')}>
                  Event Name {sortConfig.key === 'event_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  className={`filter-funnel-btn ${columnFilters.event_name?.length > 0 ? 'active' : ''}`}
                  onClick={() => setActivePopover(activePopover === 'event_name' ? null : 'event_name')}
                  title="Filter by Event Name"
                >
                  🌪️
                </button>
                {activePopover === 'event_name' && (
                  <FilterPopover
                    type="multiselect"
                    options={uniqueNames}
                    value={columnFilters.event_name || []}
                    onChange={(val) => setColumnFilters(prev => ({ ...prev, event_name: val }))}
                    onClose={() => setActivePopover(null)}
                  />
                )}
              </div>

              {/* Date Header */}
              <div role="columnheader" className="column-header-cell">
                <button type="button" className="column-header-btn" onClick={() => handleSortToggle('event_date')}>
                  Date {sortConfig.key === 'event_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  className={`filter-funnel-btn ${(columnFilters.event_date?.from || columnFilters.event_date?.to) ? 'active' : ''}`}
                  onClick={() => setActivePopover(activePopover === 'event_date' ? null : 'event_date')}
                  title="Filter by Date Range"
                >
                  🌪️
                </button>
                {activePopover === 'event_date' && (
                  <FilterPopover
                    type="daterange"
                    value={columnFilters.event_date || { from: '', to: '' }}
                    onChange={(val) => setColumnFilters(prev => ({ ...prev, event_date: val }))}
                    onClose={() => setActivePopover(null)}
                  />
                )}
              </div>

              {/* Status Header */}
              <div role="columnheader" className="column-header-cell">
                <button type="button" className="column-header-btn" onClick={() => handleSortToggle('status')}>
                  Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  className={`filter-funnel-btn ${columnFilters.status?.length > 0 ? 'active' : ''}`}
                  onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
                  title="Filter by Status"
                >
                  🌪️
                </button>
                {activePopover === 'status' && (
                  <FilterPopover
                    type="multiselect"
                    options={['Open', 'Closed', 'Synced']}
                    value={columnFilters.status || []}
                    onChange={(val) => setColumnFilters(prev => ({ ...prev, status: val }))}
                    onClose={() => setActivePopover(null)}
                  />
                )}
              </div>

              {/* Synced By Header */}
              <div role="columnheader" className="column-header-cell">
                <button type="button" className="column-header-btn" onClick={() => handleSortToggle('synced_by')}>
                  Synced By {sortConfig.key === 'synced_by' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  className={`filter-funnel-btn ${columnFilters.synced_by?.length > 0 ? 'active' : ''}`}
                  onClick={() => setActivePopover(activePopover === 'synced_by' ? null : 'synced_by')}
                  title="Filter by Synced By"
                >
                  🌪️
                </button>
                {activePopover === 'synced_by' && (
                  <FilterPopover
                    type="multiselect"
                    options={uniqueSyncedBy.map(u => u.name)}
                    value={columnFilters.synced_by || []}
                    onChange={(val) => setColumnFilters(prev => ({ ...prev, synced_by: val }))}
                    onClose={() => setActivePopover(null)}
                  />
                )}
              </div>

              {/* Actions Header — admin only */}
              {canManage && <div role="columnheader" style={{ textAlign: 'right' }}>Actions</div>}
            </div>

            {/* Table Rows / Cards */}
            {processedEvents.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No events found matching criteria.
              </div>
            ) : (
              processedEvents.map(eventObj => (
                <div
                  key={eventObj.id}
                  className="grid-table-row"
                  style={{ gridTemplateColumns: canManage ? '1.5fr 1fr 1fr 1fr 1.5fr' : '1.5fr 1fr 1fr 1fr' }}
                  role="row"
                >
                  {/* Event Name — clickable link */}
                  <div className="grid-table-cell" role="cell">
                    <span className="grid-table-label">Event Name</span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => handleViewAttendees(eventObj)}
                      title="Click to view attendees"
                    >
                      {eventObj.event_name}
                    </button>
                  </div>

                  {/* Date */}
                  <div className="grid-table-cell" role="cell">
                    <span className="grid-table-label">Date</span>
                    <span>{eventObj.event_date}</span>
                  </div>

                  {/* Status */}
                  <div className="grid-table-cell" role="cell">
                    <span className="grid-table-label">Status</span>
                    <div>
                      <span className={`badge ${getStatusBadgeClass(eventObj)}`}>
                        {getStatusLabel(eventObj)}
                      </span>
                    </div>
                  </div>

                  {/* Synced By */}
                  <div className="grid-table-cell" role="cell">
                    <span className="grid-table-label">Synced By</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {eventObj.synced_by ? (usersMap[eventObj.synced_by] || 'Admin') : '-'}
                    </span>
                  </div>

                  {/* Actions — admin only */}
                  {canManage && (
                    <div className="grid-table-cell" role="cell" style={{ justifyContent: 'flex-end' }}>
                      <span className="grid-table-label">Actions</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleViewAttendees(eventObj)}
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                        >
                          View Attendees
                        </button>
                        {eventObj.synced_at && (
                          <button
                            type="button"
                            className="btn btn-reset-sync"
                            onClick={() => handleResetSyncEvent(eventObj.id)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                            title="Reset Sync Status"
                          >
                            Reset Sync
                          </button>
                        )}
                        {!eventObj.synced_at && eventObj.ended_at && (
                          <button
                            type="button"
                            className="btn btn-destructive"
                            onClick={() => handleDeleteEvent(eventObj.id)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                            title="Delete Event"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedEventIds.length > 0 && (
        <div className="bulk-action-pill">
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {selectedEventIds.length} event{selectedEventIds.length > 1 ? 's' : ''} selected
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Close Button: Blue */}
            <button
              type="button"
              className="btn btn-close"
              onClick={handleBulkClose}
              disabled={!canBulkClose}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              title={!canBulkClose ? "Close is disabled: all selected events must be open (not closed or synced)" : "Close selected events"}
            >
              Close
            </button>

            {/* Reopen Button: Green */}
            <button
              type="button"
              className="btn btn-reopen"
              onClick={handleBulkReopen}
              disabled={!canBulkReopen}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              title={!canBulkReopen ? "Reopen is disabled: all selected events must be closed and not synced" : "Reopen selected events"}
            >
              Reopen
            </button>

            {/* Reset Sync Button: Purple */}
            <button
              type="button"
              className="btn btn-reset-sync"
              onClick={handleBulkResetSync}
              disabled={!canBulkResetSync}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              title={!canBulkResetSync ? "Reset Sync is disabled: all selected events must be synced" : "Reset sync status"}
            >
              Reset Sync
            </button>

            {/* Delete Button: Red */}
            {canManage && (
              <button
                type="button"
                className="btn btn-destructive"
                onClick={handleBulkDelete}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                title="Delete selected events"
              >
                Delete
              </button>
            )}

            {/* Clear Selection */}
            <button
              type="button"
              className="btn-link"
              onClick={() => setSelectedEventIds([])}
              style={{ fontSize: '0.8rem', marginLeft: '0.5rem', color: 'var(--text-secondary)' }}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Mobile Filter & Sort Bottom Sheet */}
      {isMobileSheetOpen && (
        <div className="filter-sheet-overlay" onClick={() => setIsMobileSheetOpen(false)}>
          <div className="filter-sheet" onClick={e => e.stopPropagation()}>
            <div className="filter-sheet-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Filter & Sort Events</h3>
              <button
                type="button"
                className="filter-popover-close"
                onClick={() => setIsMobileSheetOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="filter-sheet-body">
              {/* Sort section */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                  Sort By:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {[
                    { key: 'event_name', label: 'Event Name' },
                    { key: 'event_date', label: 'Date' },
                    { key: 'status', label: 'Status' },
                    { key: 'synced_by', label: 'Synced By' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`btn ${sortConfig.key === opt.key ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleSortToggle(opt.key)}
                      style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                    >
                      {opt.label} {sortConfig.key === opt.key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                  Status:
                </label>
                {['Open', 'Closed', 'Synced'].map(st => (
                  <label key={st} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={(columnFilters.status || []).includes(st)}
                      onChange={e => {
                        const current = columnFilters.status || [];
                        if (e.target.checked) {
                          setColumnFilters(prev => ({ ...prev, status: [...current, st] }));
                        } else {
                          setColumnFilters(prev => ({ ...prev, status: current.filter(x => x !== st) }));
                        }
                      }}
                    />
                    {st}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsMobileSheetOpen(false)}
                style={{ flex: 1 }}
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start New Event Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Start New Event"
        >
          <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Event Name:
              </label>
              <input
                type="text"
                placeholder="e.g. Weekly Troop Meeting"
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--foreground)',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Event Date:
              </label>
              <input
                type="date"
                value={newEventDate}
                onChange={e => setNewEventDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--foreground)',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-start"
                disabled={creatingEvent}
              >
                {creatingEvent ? 'Creating...' : 'Start Event'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Attendees Drill-down Modal */}
      {selectedEventModal && (
        <Modal
          isOpen={!!selectedEventModal}
          onClose={() => setSelectedEventModal(null)}
          title={`Attendees: ${selectedEventModal.event_name} (${selectedEventModal.event_date})`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Total Attendees Scanned: <strong>{eventAttendees.length}</strong>
              </span>
              <input
                type="text"
                placeholder="Search attendees..."
                value={attendeeSearch}
                onChange={e => setAttendeeSearch(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--foreground)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {loadingAttendees ? (
              <p>Loading attendees...</p>
            ) : (
              <DataTable
                columns={attendeeColumns}
                data={filteredAttendees}
                storageKey="event_attendees_modal"
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedEventModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Export Sessions alias for backward compatibility
export const Sessions = Events;
