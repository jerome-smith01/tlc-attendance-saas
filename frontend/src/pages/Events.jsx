import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const [showActionGuide, setShowActionGuide] = useState(false);

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
    event_date: { from: '', to: '', dates: [] },
    status: [],
    synced_by: [],
    actions: []
  };

  const defaultSort = { key: null, direction: 'asc' };

  const defaultColumnWidths = useMemo(() => ({
    event_name: 2.5,
    event_date: 1.0,
    status: 1.0,
    synced_by: 1.0,
    actions: 1.3
  }), []);

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

  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.columnWidths) return { ...defaultColumnWidths, ...parsed.columnWidths };
      }
    } catch (e) {
      console.warn('Failed to load saved column widths', e);
    }
    return defaultColumnWidths;
  });

  // Save sort, filter, and column width state on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sortConfig, columnFilters, columnWidths }));
    } catch (e) {
      console.warn('Failed to persist table state', e);
    }
  }, [sortConfig, columnFilters, columnWidths, storageKey]);



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
    if (eventObj.ended_at) return 'badge-closed';
    return 'badge-success';
  };

  // Compute unique values for popovers
  const uniqueNames = useMemo(() => {
    const names = events.map(s => s.event_name).filter(Boolean);
    return [...new Set(names)].sort();
  }, [events]);

  const uniqueDates = useMemo(() => {
    const dates = events.map(s => s.event_date).filter(Boolean);
    const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
    return unique.map(d => ({ label: d, value: d }));
  }, [events]);

  const uniqueSyncedBy = useMemo(() => {
    const ids = events.map(s => s.synced_by).filter(Boolean);
    const uniqueIds = [...new Set(ids)];
    return uniqueIds.map(id => ({
      id,
      name: usersMap[id] || id
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [events, usersMap]);

  const uniqueStatuses = useMemo(() => {
    const statuses = events.map(s => getStatusLabel(s)).filter(Boolean);
    const unique = [...new Set(statuses)].sort();
    return unique.map(st => ({ label: st, value: st }));
  }, [events]);

  const uniqueActions = useMemo(() => {
    const actions = new Set();
    events.forEach(s => {
      if (!s.synced_at && !s.ended_at) actions.add('Close');
      if (!s.synced_at && s.ended_at) actions.add('Reopen');
      if (s.synced_at) actions.add('Reset Sync');
    });
    return Array.from(actions).map(act => ({ label: act, value: act }));
  }, [events]);

  // Filter & Sort Logic
  const getFilteredEvents = (excludeColumn = null) => {
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
    if (excludeColumn !== 'event_name' && columnFilters.event_name && columnFilters.event_name.length > 0) {
      result = result.filter(s => columnFilters.event_name.includes(s.event_name));
    }

    if (excludeColumn !== 'event_date') {
      if (columnFilters.event_date?.from) {
        result = result.filter(s => s.event_date >= columnFilters.event_date.from);
      }
      if (columnFilters.event_date?.to) {
        result = result.filter(s => s.event_date <= columnFilters.event_date.to);
      }
      if (columnFilters.event_date?.dates && columnFilters.event_date.dates.length > 0) {
        result = result.filter(s => columnFilters.event_date.dates.includes(s.event_date));
      }
    }

    if (excludeColumn !== 'status' && columnFilters.status && columnFilters.status.length > 0) {
      result = result.filter(s => columnFilters.status.includes(getStatusLabel(s)));
    }

    if (excludeColumn !== 'synced_by' && columnFilters.synced_by && columnFilters.synced_by.length > 0) {
      result = result.filter(s => {
        if (!s.synced_by) return false;
        const name = usersMap[s.synced_by] || s.synced_by;
        return columnFilters.synced_by.includes(name);
      });
    }

    if (excludeColumn !== 'actions' && columnFilters.actions && columnFilters.actions.length > 0) {
      result = result.filter(s => {
        const canClose = !s.synced_at && !s.ended_at;
        const canReopen = !s.synced_at && s.ended_at;
        const canResetSync = Boolean(s.synced_at);

        if (columnFilters.actions.includes('Close') && canClose) return true;
        if (columnFilters.actions.includes('Reopen') && canReopen) return true;
        if (columnFilters.actions.includes('Reset Sync') && canResetSync) return true;
        return false;
      });
    }

    return result;
  };

  const availableEventNames = useMemo(() => {
    return new Set(getFilteredEvents('event_name').map(s => s.event_name).filter(Boolean));
  }, [events, eventSearch, columnFilters, usersMap]);

  const availableDates = useMemo(() => {
    return new Set(getFilteredEvents('event_date').map(s => s.event_date).filter(Boolean));
  }, [events, eventSearch, columnFilters, usersMap]);

  const availableStatuses = useMemo(() => {
    return new Set(getFilteredEvents('status').map(s => getStatusLabel(s)).filter(Boolean));
  }, [events, eventSearch, columnFilters, usersMap]);

  const availableSyncedBy = useMemo(() => {
    return new Set(getFilteredEvents('synced_by').map(s => usersMap[s.synced_by] || s.synced_by).filter(Boolean));
  }, [events, eventSearch, columnFilters, usersMap]);

  const availableActions = useMemo(() => {
    const data = getFilteredEvents('actions');
    const acts = new Set();
    data.forEach(s => {
      if (!s.synced_at && !s.ended_at) acts.add('Close');
      if (!s.synced_at && s.ended_at) acts.add('Reopen');
      if (s.synced_at) acts.add('Reset Sync');
    });
    return acts;
  }, [events, eventSearch, columnFilters, usersMap]);

  const processedEvents = useMemo(() => {
    let result = getFilteredEvents(null);

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
  const currentUserRole = selectedTroop?.currentUserRole;
  const canManage = isGlobalAdmin || currentUserRole === 'billing_admin' || currentUserRole === 'troop_admin';

  const headerRef = useRef(null);

  const gridTemplateStyle = useMemo(() => {
    if (canManage) {
      return {
        gridTemplateColumns: `48px ${columnWidths.event_name || 2.5}fr ${columnWidths.event_date || 1.0}fr ${columnWidths.status || 1.0}fr ${columnWidths.synced_by || 1.0}fr ${columnWidths.actions || 1.3}fr`
      };
    }
    return {
      gridTemplateColumns: `${columnWidths.event_name || 2.5}fr ${columnWidths.event_date || 1.0}fr ${columnWidths.status || 1.0}fr ${columnWidths.synced_by || 1.0}fr`
    };
  }, [canManage, columnWidths]);

  const handleStartResize = (e, leftCol, rightCol) => {
    e.preventDefault();
    e.stopPropagation();

    if (!headerRef.current) return;

    const containerRect = headerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startLeftFr = columnWidths[leftCol] ?? defaultColumnWidths[leftCol];
    const startRightFr = columnWidths[rightCol] ?? defaultColumnWidths[rightCol];

    const activeCols = canManage
      ? ['event_name', 'event_date', 'status', 'synced_by', 'actions']
      : ['event_name', 'event_date', 'status', 'synced_by'];

    const totalFr = activeCols.reduce((sum, col) => sum + (columnWidths[col] ?? defaultColumnWidths[col]), 0);
    const availWidth = canManage ? Math.max(100, containerRect.width - 48) : containerRect.width;

    const handleMouseMove = (moveEv) => {
      const deltaX = moveEv.clientX - startX;
      const deltaFr = (deltaX / availWidth) * totalFr;

      const minFr = 0.4;
      let newLeftFr = startLeftFr + deltaFr;
      let newRightFr = startRightFr - deltaFr;

      if (newLeftFr < minFr) {
        newLeftFr = minFr;
        newRightFr = startLeftFr + startRightFr - minFr;
      } else if (newRightFr < minFr) {
        newRightFr = minFr;
        newLeftFr = startLeftFr + startRightFr - minFr;
      }

      setColumnWidths(prev => ({
        ...prev,
        [leftCol]: Number(newLeftFr.toFixed(2)),
        [rightCol]: Number(newRightFr.toFixed(2))
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

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

  // Single-row: Close
  const handleCloseEvent = async (eventObj) => {
    if (await confirm(`Are you sure you want to close the event "${eventObj.event_name}"? This will approve all pending scans for this event.`)) {
      const now = new Date().toISOString();
      let { error: eventError } = await supabase
        .from('events')
        .update({ ended_at: now })
        .eq('id', eventObj.id);

      if (eventError && (eventError.code === '42P01' || eventError.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .update({ ended_at: now })
          .eq('id', eventObj.id);
        eventError = res.error;
      }

      if (eventError) {
        toast("Error closing event: " + eventError.message, 'error');
        return;
      }

      let { error: scansError } = await supabase
        .from('scans')
        .update({ status: 'approved' })
        .eq('event_id', eventObj.id)
        .eq('status', 'pending');

      if (scansError && scansError.message.includes('event_id')) {
        const res = await supabase
          .from('scans')
          .update({ status: 'approved' })
          .eq('session_id', eventObj.id)
          .eq('status', 'pending');
        scansError = res.error;
      }

      if (scansError) {
        toast("Error approving scans: " + scansError.message, 'error');
        return;
      }

      setEvents(prev => prev.map(s => s.id === eventObj.id ? { ...s, ended_at: now } : s));
      toast(`Event closed`, 'success');
    }
  };

  // Single-row: Reopen
  const handleReopenEvent = async (eventObj) => {
    if (await confirm(`Are you sure you want to reopen the event "${eventObj.event_name}"?`)) {
      let { error } = await supabase
        .from('events')
        .update({ ended_at: null })
        .eq('id', eventObj.id);

      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .update({ ended_at: null })
          .eq('id', eventObj.id);
        error = res.error;
      }

      if (error) {
        toast("Error reopening event: " + error.message, 'error');
      } else {
        setEvents(prev => prev.map(s => s.id === eventObj.id ? { ...s, ended_at: null } : s));
        toast(`Event reopened`, 'success');
      }
    }
  };

  // Single-row: Reset Sync
  const handleResetSyncEvent = async (eventId) => {
    if (await confirm('Reset sync status for this event? It will be marked as unsynced and can be synced again.')) {
      let { error } = await supabase
        .from('events')
        .update({ synced_at: null, synced_by: null, purge_after: null })
        .eq('id', eventId);

      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .update({ synced_at: null, synced_by: null, purge_after: null })
          .eq('id', eventId);
        error = res.error;
      }

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
      let { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error && (error.code === '42P01' || error.message.includes('events'))) {
        const res = await supabase.from('sessions').delete().eq('id', eventId);
        error = res.error;
      }
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
      const labelStr = columnFilters.event_name.length > 2
        ? `${columnFilters.event_name.length} selected`
        : columnFilters.event_name.join(', ');
      chips.push({
        id: 'event_name',
        label: `Event Name: ${labelStr.length > 50 ? labelStr.substring(0, 50) + '...' : labelStr}`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, event_name: [] }))
      });
    }

    if (columnFilters.event_date?.from || columnFilters.event_date?.to || (columnFilters.event_date?.dates && columnFilters.event_date.dates.length > 0)) {
      const parts = [];
      if (columnFilters.event_date.from && columnFilters.event_date.to) {
        parts.push(`${columnFilters.event_date.from} to ${columnFilters.event_date.to}`);
      } else if (columnFilters.event_date.from) {
        parts.push(`From ${columnFilters.event_date.from}`);
      } else if (columnFilters.event_date.to) {
        parts.push(`Until ${columnFilters.event_date.to}`);
      }
      if (columnFilters.event_date.dates && columnFilters.event_date.dates.length > 0) {
        const datesLabel = columnFilters.event_date.dates.length > 2 
          ? `${columnFilters.event_date.dates.length} selected`
          : columnFilters.event_date.dates.join(', ');
        parts.push(datesLabel);
      }
      chips.push({
        id: 'event_date',
        label: `Date: ${parts.join(' | ')}`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, event_date: { from: '', to: '', dates: [] } }))
      });
    }

    if (columnFilters.status && columnFilters.status.length > 0) {
      const labelStr = columnFilters.status.length > 2
        ? `${columnFilters.status.length} selected`
        : columnFilters.status.join(', ');
      chips.push({
        id: 'status',
        label: `Status: ${labelStr}`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, status: [] }))
      });
    }

    if (columnFilters.synced_by && columnFilters.synced_by.length > 0) {
      const labelStr = columnFilters.synced_by.length > 2
        ? `${columnFilters.synced_by.length} selected`
        : columnFilters.synced_by.join(', ');
      chips.push({
        id: 'synced_by',
        label: `Synced By: ${labelStr.length > 50 ? labelStr.substring(0, 50) + '...' : labelStr}`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, synced_by: [] }))
      });
    }

    if (columnFilters.actions && columnFilters.actions.length > 0) {
      const labelStr = columnFilters.actions.length > 2
        ? `${columnFilters.actions.length} selected`
        : columnFilters.actions.join(', ');
      chips.push({
        id: 'actions',
        label: `Actions: ${labelStr}`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, actions: [] }))
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
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>
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
          <div className={`grid-table-container ${selectedEventIds.length > 0 ? 'has-bulk-selection' : ''}`}>
            {/* Table Header (Desktop Only) */}
            <div
              ref={headerRef}
              className={`grid-table-header ${canManage ? '' : 'no-manage'}`}
              role="row"
              style={gridTemplateStyle}
            >

              {/* Selection Header */}
              {canManage && (
                <div role="columnheader" className="column-header-cell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '1rem' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={input => { if (input) input.indeterminate = isSomeSelected; }}
                    onChange={handleToggleSelectAll}
                    style={{ margin: 0, cursor: 'pointer', width: '18px', height: '18px' }}
                    title="Select All"
                  />
                </div>
              )}

              {/* Event Name Header */}
              <div role="columnheader" className="column-header-cell">
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'event_name' ? null : 'event_name')}>
                  Event Name 
                  {sortConfig.key === 'event_name' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.event_name?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'event_name' && (
                  <FilterPopover
                    isOpen={true}
                    title="Event Name"
                    type="multiselect"
                    options={uniqueNames.map(name => ({ 
                      label: name, 
                      value: name,
                      disabled: !availableEventNames.has(name)
                    }))}
                    value={columnFilters.event_name || []}
                    onChange={(val) => setColumnFilters(prev => ({ ...prev, event_name: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig}
                    columnKey="event_name"
                    onSort={(dir) => setSortConfig({ key: 'event_name', direction: dir })}
                    sortAscLabel="Sort A to Z"
                    sortDescLabel="Sort Z to A"
                  />
                )}
                <div
                  className="column-resizer"
                  onMouseDown={(e) => handleStartResize(e, 'event_name', 'event_date')}
                  title="Drag to resize column"
                />
              </div>

              {/* Date Header */}
              <div role="columnheader" className="column-header-cell">
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'event_date' ? null : 'event_date')}>
                  Date 
                  {sortConfig.key === 'event_date' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {(columnFilters.event_date?.from || columnFilters.event_date?.to || columnFilters.event_date?.dates?.length > 0) && ' 🌪️'}
                </button>
                {activePopover === 'event_date' && (
                  <FilterPopover
                    isOpen={true}
                    title="Date"
                    type="daterange"
                    options={uniqueDates.map(opt => ({ ...opt, disabled: !availableDates.has(opt.value) }))}
                    value={columnFilters.event_date || { from: '', to: '', dates: [] }}
                    onChange={(val) => setColumnFilters(prev => ({ ...prev, event_date: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig}
                    columnKey="event_date"
                    onSort={(dir) => setSortConfig({ key: 'event_date', direction: dir })}
                    sortAscLabel="Sort Oldest to Newest"
                    sortDescLabel="Sort Newest to Oldest"
                  />
                )}
                <div
                  className="column-resizer"
                  onMouseDown={(e) => handleStartResize(e, 'event_date', 'status')}
                  title="Drag to resize column"
                />
              </div>

              {/* Status Header */}
              <div role="columnheader" className="column-header-cell">
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}>
                  Status 
                  {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.status?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'status' && (
                  <FilterPopover
                    isOpen={true}
                    title="Status"
                    type="multiselect"
                    options={uniqueStatuses.map(opt => ({ ...opt, disabled: !availableStatuses.has(opt.value) }))}
                    value={columnFilters.status || []}
                    onChange={(val) => setColumnFilters(prev => ({ ...prev, status: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig}
                    columnKey="status"
                    onSort={(dir) => setSortConfig({ key: 'status', direction: dir })}
                    sortAscLabel="Sort A to Z"
                    sortDescLabel="Sort Z to A"
                  />
                )}
                <div
                  className="column-resizer"
                  onMouseDown={(e) => handleStartResize(e, 'status', 'synced_by')}
                  title="Drag to resize column"
                />
              </div>

              {/* Synced By Header */}
              <div role="columnheader" className="column-header-cell">
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'synced_by' ? null : 'synced_by')}>
                  Synced By 
                  {sortConfig.key === 'synced_by' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.synced_by?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'synced_by' && (
                  <FilterPopover
                    isOpen={true}
                    title="Synced By"
                    type="multiselect"
                    options={uniqueSyncedBy.map(u => ({ 
                      label: u.name, 
                      value: u.name,
                      disabled: !availableSyncedBy.has(u.name)
                    }))}
                    value={columnFilters.synced_by || []}
                    onChange={(val) => setColumnFilters(prev => ({ ...prev, synced_by: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig}
                    columnKey="synced_by"
                    onSort={(dir) => setSortConfig({ key: 'synced_by', direction: dir })}
                    sortAscLabel="Sort A to Z"
                    sortDescLabel="Sort Z to A"
                  />
                )}
                {canManage && (
                  <div
                    className="column-resizer"
                    onMouseDown={(e) => handleStartResize(e, 'synced_by', 'actions')}
                    title="Drag to resize column"
                  />
                )}
              </div>

              {/* Actions Header — admin only */}
              {canManage && (
                <div role="columnheader" className="column-header-cell">
                  <button
                    type="button"
                    className="column-header-btn"
                    onClick={() => setActivePopover(activePopover === 'actions' ? null : 'actions')}
                  >
                    Actions 
                    {columnFilters.actions?.length > 0 && ' 🌪️'}
                  </button>
                  {activePopover === 'actions' && (
                    <FilterPopover
                      isOpen={true}
                      title="Actions"
                      type="multiselect"
                      options={uniqueActions.map(opt => ({ ...opt, disabled: !availableActions.has(opt.value) }))}
                      value={columnFilters.actions || []}
                      onChange={(val) => setColumnFilters(prev => ({ ...prev, actions: val }))}
                      onClose={() => setActivePopover(null)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Table Rows / Cards */}
            {processedEvents.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No events found matching criteria.
              </div>
            ) : (
              processedEvents.map(eventObj => {
                const canCloseRow = !eventObj.synced_at && !eventObj.ended_at;
                const canReopenRow = !eventObj.synced_at && eventObj.ended_at;
                const canResetSyncRow = Boolean(eventObj.synced_at);

                return (
                  <div
                    key={eventObj.id}
                    className={`grid-table-row ${canManage ? '' : 'no-manage'}`}
                    role="row"
                    style={gridTemplateStyle}
                  >
                    {/* Header Group (Mobile: Checkbox + Event Name Link / Desktop: grid contents) */}
                    <div className="grid-table-card-header">
                      {/* Selection Cell */}
                      {canManage && (
                        <div className="grid-table-cell grid-table-cell-select" role="cell">
                          <input
                            type="checkbox"
                            checked={selectedEventIds.includes(eventObj.id)}
                            onChange={() => handleToggleSelectRow(eventObj.id)}
                            style={{ margin: 0, cursor: 'pointer', width: '18px', height: '18px' }}
                            title="Select event"
                          />
                        </div>
                      )}

                      {/* Event Name — clickable link */}
                      <div className="grid-table-cell grid-table-cell-name" role="cell">
                        <button
                          type="button"
                          className="btn-link event-name-link"
                          onClick={() => handleViewAttendees(eventObj)}
                          title="Click to view attendees"
                        >
                          {eventObj.event_name}
                        </button>
                      </div>
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
                      <div className="grid-table-cell" role="cell">
                        <span className="grid-table-label">Actions</span>
                        <div className="table-actions-group">
                          {/* Close Action */}
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-close"
                            disabled={!canCloseRow}
                            onClick={() => canCloseRow && handleCloseEvent(eventObj)}
                            title={canCloseRow ? "Close Event" : "Close unavailable: event is already closed or synced"}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </button>

                          {/* Reopen Action */}
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-reopen"
                            disabled={!canReopenRow}
                            onClick={() => canReopenRow && handleReopenEvent(eventObj)}
                            title={canReopenRow ? "Reopen Event" : "Reopen unavailable: event is open or already synced"}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                            </svg>
                          </button>

                          {/* Reset Sync Action */}
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-reset-sync"
                            disabled={!canResetSyncRow}
                            onClick={() => canResetSyncRow && handleResetSyncEvent(eventObj.id)}
                            title={canResetSyncRow ? "Reset Sync Status" : "Reset Sync unavailable: event has not been synced yet"}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10" />
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                          </button>

                          {/* Delete Action */}
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-destructive"
                            onClick={() => handleDeleteEvent(eventObj.id)}
                            title="Delete Event"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedEventIds.length > 0 && (
        <div className="bulk-action-pill">
          {/* Left Side: Count, Label & Clear */}
          <div className="bulk-action-pill-info">
            <span className="bulk-action-pill-count">{selectedEventIds.length}</span>
            <span className="bulk-action-pill-label">Selected</span>
            <button
              type="button"
              className="btn-icon-action btn-icon-clear"
              onClick={() => setSelectedEventIds([])}
              title="Clear selection"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Vertical Divider */}
          <div className="bulk-action-pill-divider" />

          {/* Right Side: Action Icons */}
          <div className="bulk-action-pill-actions">
            {/* Close Action: Blue */}
            <button
              type="button"
              className="btn-icon-action btn-icon-close"
              disabled={!canBulkClose}
              onClick={handleBulkClose}
              title={!canBulkClose ? "Close unavailable: all selected events must be open (not closed or synced)" : "Close selected events"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="bulk-action-btn-text">Close</span>
            </button>

            {/* Reopen Action: Green */}
            <button
              type="button"
              className="btn-icon-action btn-icon-reopen"
              disabled={!canBulkReopen}
              onClick={handleBulkReopen}
              title={!canBulkReopen ? "Reopen unavailable: all selected events must be closed and not synced" : "Reopen selected events"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
              <span className="bulk-action-btn-text">Reopen</span>
            </button>

            {/* Reset Sync Action: Purple */}
            <button
              type="button"
              className="btn-icon-action btn-icon-reset-sync"
              disabled={!canBulkResetSync}
              onClick={handleBulkResetSync}
              title={!canBulkResetSync ? "Reset Sync unavailable: all selected events must be synced" : "Reset sync status"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span className="bulk-action-btn-text">Reset Sync</span>
            </button>

            {/* Delete Action: Red */}
            {canManage && (
              <button
                type="button"
                className="btn-icon-action btn-icon-destructive"
                onClick={handleBulkDelete}
                title="Delete selected events"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span className="bulk-action-btn-text">Delete</span>
              </button>
            )}

            {/* Help Divider & Icon */}
            <div className="bulk-action-pill-divider" />
            <button
              type="button"
              className="btn-icon-action btn-icon-help"
              onClick={() => setShowActionGuide(prev => !prev)}
              title="Action Guide"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>

            {/* Action Guide Popover */}
            {showActionGuide && (
              <div className="action-guide-popover">
                <div className="action-guide-header">
                  <span>ACTION GUIDE</span>
                  <button
                    type="button"
                    className="action-guide-close"
                    onClick={() => setShowActionGuide(false)}
                    title="Close guide"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="action-guide-body">
                  <div className="action-guide-item">
                    <span className="action-guide-icon btn-icon-close">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <span>Close Event</span>
                  </div>
                  <div className="action-guide-item">
                    <span className="action-guide-icon btn-icon-reopen">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      </svg>
                    </span>
                    <span>Reopen Event</span>
                  </div>
                  <div className="action-guide-item">
                    <span className="action-guide-icon btn-icon-reset-sync">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                    </span>
                    <span>Reset Sync</span>
                  </div>
                  <div className="action-guide-item">
                    <span className="action-guide-icon btn-icon-destructive">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </span>
                    <span>Delete Event</span>
                  </div>
                </div>
                <div className="action-guide-arrow" />
              </div>
            )}
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

              {/* Date Filter */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                  Date Range:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      From:
                    </label>
                    <input
                      type="date"
                      className="filter-input"
                      value={columnFilters.event_date?.from || ''}
                      onChange={e => setColumnFilters(prev => ({ ...prev, event_date: { ...prev.event_date, from: e.target.value } }))}
                      onClick={e => { try { e.target.showPicker?.(); } catch (_) {} }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      To:
                    </label>
                    <input
                      type="date"
                      className="filter-input"
                      value={columnFilters.event_date?.to || ''}
                      onChange={e => setColumnFilters(prev => ({ ...prev, event_date: { ...prev.event_date, to: e.target.value } }))}
                      onClick={e => { try { e.target.showPicker?.(); } catch (_) {} }}
                    />
                  </div>
                </div>

                {uniqueDates.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '0.35rem', color: 'var(--foreground)' }}>
                      Specific Dates:
                    </label>
                    <div className="filter-multiselect-list" style={{ maxHeight: '120px' }}>
                      {uniqueDates.map(opt => {
                        const selected = Array.isArray(columnFilters.event_date?.dates) ? columnFilters.event_date.dates : [];
                        const checked = selected.includes(opt.value);
                        return (
                          <label key={opt.value} className="filter-multiselect-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                const current = Array.isArray(columnFilters.event_date?.dates) ? columnFilters.event_date.dates : [];
                                if (e.target.checked) {
                                  setColumnFilters(prev => ({ ...prev, event_date: { ...prev.event_date, dates: [...current, opt.value] } }));
                                } else {
                                  setColumnFilters(prev => ({ ...prev, event_date: { ...prev.event_date, dates: current.filter(x => x !== opt.value) } }));
                                }
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                onClick={e => { try { e.target.showPicker?.(); } catch (_) {} }}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--foreground)',
                  fontSize: '0.95rem',
                  colorScheme: 'dark',
                  cursor: 'pointer'
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
