import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';
import { useAuth } from '../context/AuthContext';
import { DataTable } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { FilterPopover } from '../components/common/FilterPopover';
import { useConfirm } from '../components/common/ConfirmContext';
import { useToast } from '../components/common/ToastContext';

export function Sessions() {
  const { selectedTroopId, selectedTroop, isGlobalAdmin, loadingTroops } = useTroop();
  const { session: authSession } = useAuth();
  const userId = authSession?.user?.id || 'anonymous';
  const storageKey = `tlc_sessions_filters_${userId}`;

  const [sessions, setSessions] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedSessionModal, setSelectedSessionModal] = useState(null);
  const [sessionAttendees, setSessionAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  // Start new session states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [creatingSession, setCreatingSession] = useState(false);

  // Search & Filter & Sort states
  const [sessionSearch, setSessionSearch] = useState('');
  const [activePopover, setActivePopover] = useState(null); // 'event_name' | 'event_date' | 'status' | 'synced_by'
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const defaultFilters = {
    event_name: '',
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
        if (parsed.columnFilters) return parsed.columnFilters;
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
        .select('id, scan_time, status, roster(id, first_name, last_initial, member_id, tlc_id)')
        .eq('session_id', session.id)
        .order('scan_time', { ascending: true });

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

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventDate) return;

    setCreatingSession(true);
    try {
      const { data, error } = await supabase
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

      if (error) throw error;

      setSessions(prev => [data, ...prev].sort((a, b) => new Date(b.event_date) - new Date(a.event_date)));
      setIsCreateModalOpen(false);
      setNewEventName('');
      setNewEventDate(new Date().toISOString().split('T')[0]);
      toast('Session created successfully', 'success');
    } catch (err) {
      console.error('Error creating session:', err);
      toast('Error creating session: ' + err.message, 'error');
    } finally {
      setCreatingSession(false);
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

  const canManage = isGlobalAdmin || selectedTroop?.currentUserRole === 'troop_admin' || selectedTroop?.currentUserRole === 'billing_admin';

  const gridColumnsStyle = {
    gridTemplateColumns: canManage ? '1.5fr 1fr 1fr 1fr 1.5fr' : '1.5fr 1fr 1fr 1fr'
  };

  // Helper values for status and synced_by
  const getSessionStatus = (session) => {
    if (session.synced_at) return 'Synced';
    if (session.ended_at) return 'Ended';
    return 'Pending Sync';
  };

  const getSyncedByName = (session) => {
    if (!session.synced_by) return 'Not Synced';
    return usersMap[session.synced_by] || (`User ${session.synced_by.substring(0, 8)}...`);
  };

  // Dynamic filter options derived from current sessions dataset
  const uniqueStatusOptions = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => set.add(getSessionStatus(s)));
    const labels = {
      'Synced': '✅ Synced',
      'Ended': '🛑 Ended',
      'Pending Sync': '⏳ Pending Sync'
    };
    return Array.from(set).map(val => ({
      label: labels[val] || val,
      value: val
    }));
  }, [sessions]);

  const uniqueSyncedByOptions = useMemo(() => {
    const names = new Set();
    sessions.forEach(s => {
      if (s.synced_by) {
        names.add(getSyncedByName(s));
      }
    });
    return Array.from(names).map(name => ({
      label: name,
      value: name
    }));
  }, [sessions, usersMap]);

  // Main Filter and Sort Pipeline
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // 1. Global Search
    if (sessionSearch) {
      const lower = sessionSearch.toLowerCase();
      result = result.filter(session => {
        const eventName = session.event_name?.toLowerCase() || '';
        const eventDate = session.event_date?.toLowerCase() || '';
        const syncedBy = getSyncedByName(session).toLowerCase();
        return eventName.includes(lower) || eventDate.includes(lower) || syncedBy.includes(lower);
      });
    }

    // 2. Column Filters
    if (columnFilters.event_name) {
      const lower = columnFilters.event_name.toLowerCase();
      result = result.filter(s => (s.event_name || '').toLowerCase().includes(lower));
    }

    if (columnFilters.event_date?.from) {
      result = result.filter(s => (s.event_date || '') >= columnFilters.event_date.from);
    }
    if (columnFilters.event_date?.to) {
      result = result.filter(s => (s.event_date || '') <= columnFilters.event_date.to);
    }

    if (columnFilters.status && columnFilters.status.length > 0) {
      result = result.filter(s => columnFilters.status.includes(getSessionStatus(s)));
    }

    if (columnFilters.synced_by && columnFilters.synced_by.length > 0) {
      result = result.filter(s => columnFilters.synced_by.includes(getSyncedByName(s)));
    }

    // 3. Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'event_name') {
          valA = (a.event_name || '').toLowerCase();
          valB = (b.event_name || '').toLowerCase();
        } else if (sortConfig.key === 'event_date') {
          valA = a.event_date || '';
          valB = b.event_date || '';
        } else if (sortConfig.key === 'status') {
          const ranks = { 'Pending Sync': 0, 'Ended': 1, 'Synced': 2 };
          valA = ranks[getSessionStatus(a)] ?? 99;
          valB = ranks[getSessionStatus(b)] ?? 99;
        } else if (sortConfig.key === 'synced_by') {
          valA = getSyncedByName(a).toLowerCase();
          valB = getSyncedByName(b).toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [sessions, sessionSearch, columnFilters, sortConfig, usersMap]);

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

    if (columnFilters.event_name) {
      chips.push({
        id: 'event_name',
        label: `Name: "${columnFilters.event_name}"`,
        onRemove: () => setColumnFilters(prev => ({ ...prev, event_name: '' }))
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
    setSessionSearch('');
  };

  const renderStatus = (session) => {
    if (session.synced_at) return <span className="badge badge-success">✅ Synced ({new Date(session.synced_at).toLocaleDateString()})</span>;
    if (session.ended_at) return <span className="badge badge-error">🛑 Ended</span>;
    return <span className="badge badge-warning">⏳ Pending Sync</span>;
  };

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

  const isFilterActive = (key) => {
    if (key === 'event_name') return !!columnFilters.event_name;
    if (key === 'event_date') return !!(columnFilters.event_date?.from || columnFilters.event_date?.to);
    if (key === 'status') return columnFilters.status?.length > 0;
    if (key === 'synced_by') return columnFilters.synced_by?.length > 0;
    return false;
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ color: 'var(--foreground)' }}>Session History</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage scanning sessions for Troop {selectedTroop?.troop_number}
          </p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
        >
          + Start New Session
        </button>
      </header>

      {loading ? (
        <p>Loading sessions...</p>
      ) : (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            A list of past scanning sessions. Synced session data is automatically purged after 30 days.
          </p>

          {/* Search Bar & Mobile Filter Trigger */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search sessions by event, date, or user..."
              value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '360px',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--foreground)'
              }}
            />

            <button
              type="button"
              className="mobile-filter-trigger"
              onClick={() => setIsMobileSheetOpen(true)}
            >
              <span>⚙️ Filter & Sort</span>
              {(activeChips.length > 0 || sortConfig.key) && (
                <span className="badge badge-success" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>
                  {activeChips.length + (sortConfig.key ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Active Filter Chips */}
          {(activeChips.length > 0 || sortConfig.key || sessionSearch) && (
            <div className="filter-chip-bar">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Active Filters:
              </span>
              {sortConfig.key && (
                <span className="filter-chip">
                  Sort: {sortConfig.key.replace('_', ' ')} ({sortConfig.direction})
                  <button className="filter-chip-remove" onClick={() => setSortConfig(defaultSort)}>&times;</button>
                </span>
              )}
              {activeChips.map(chip => (
                <span key={chip.id} className="filter-chip">
                  {chip.label}
                  <button className="filter-chip-remove" onClick={chip.onRemove}>&times;</button>
                </span>
              ))}
              <button
                type="button"
                className="btn-link"
                onClick={handleClearAll}
                style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Responsive Grid Table */}
          <div className="grid-table-container" role="table">
            {/* Header Row Container (Desktop Only) */}
            <div className="grid-table-header" style={gridColumnsStyle} role="row">
              {/* Event Name Header */}
              <div role="columnheader" className="column-header-cell">
                <button
                  className="column-header-btn"
                  onClick={() => handleSortToggle('event_name')}
                  title="Sort by Event Name"
                >
                  Event Name {renderSortIndicator('event_name')}
                </button>
                <button
                  type="button"
                  className={`filter-icon-btn ${isFilterActive('event_name') ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopover(activePopover === 'event_name' ? null : 'event_name');
                  }}
                  title="Filter Event Name"
                >
                  ▼
                  {isFilterActive('event_name') && <span className="filter-icon-badge" />}
                </button>

                <FilterPopover
                  isOpen={activePopover === 'event_name'}
                  onClose={() => setActivePopover(null)}
                  title="Event Name"
                  type="text"
                  value={columnFilters.event_name}
                  onChange={(val) => setColumnFilters(prev => ({ ...prev, event_name: val }))}
                />
              </div>

              {/* Date Header */}
              <div role="columnheader" className="column-header-cell">
                <button
                  className="column-header-btn"
                  onClick={() => handleSortToggle('event_date')}
                  title="Sort by Date"
                >
                  Date {renderSortIndicator('event_date')}
                </button>
                <button
                  type="button"
                  className={`filter-icon-btn ${isFilterActive('event_date') ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopover(activePopover === 'event_date' ? null : 'event_date');
                  }}
                  title="Filter Date"
                >
                  ▼
                  {isFilterActive('event_date') && <span className="filter-icon-badge" />}
                </button>

                <FilterPopover
                  isOpen={activePopover === 'event_date'}
                  onClose={() => setActivePopover(null)}
                  title="Date Range"
                  type="daterange"
                  value={columnFilters.event_date}
                  onChange={(val) => setColumnFilters(prev => ({ ...prev, event_date: val }))}
                />
              </div>

              {/* Status Header */}
              <div role="columnheader" className="column-header-cell">
                <button
                  className="column-header-btn"
                  onClick={() => handleSortToggle('status')}
                  title="Sort by Status"
                >
                  Status {renderSortIndicator('status')}
                </button>
                <button
                  type="button"
                  className={`filter-icon-btn ${isFilterActive('status') ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopover(activePopover === 'status' ? null : 'status');
                  }}
                  title="Filter Status"
                >
                  ▼
                  {isFilterActive('status') && <span className="filter-icon-badge" />}
                </button>

                <FilterPopover
                  isOpen={activePopover === 'status'}
                  onClose={() => setActivePopover(null)}
                  title="Status"
                  type="multiselect"
                  options={uniqueStatusOptions}
                  value={columnFilters.status}
                  onChange={(val) => setColumnFilters(prev => ({ ...prev, status: val }))}
                />
              </div>

              {/* Synced By Header */}
              <div role="columnheader" className="column-header-cell">
                <button
                  className="column-header-btn"
                  onClick={() => handleSortToggle('synced_by')}
                  title="Sort by Synced By"
                >
                  Synced By {renderSortIndicator('synced_by')}
                </button>
                <button
                  type="button"
                  className={`filter-icon-btn ${isFilterActive('synced_by') ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopover(activePopover === 'synced_by' ? null : 'synced_by');
                  }}
                  title="Filter Synced By"
                >
                  ▼
                  {isFilterActive('synced_by') && <span className="filter-icon-badge" />}
                </button>

                <FilterPopover
                  isOpen={activePopover === 'synced_by'}
                  onClose={() => setActivePopover(null)}
                  title="Synced By"
                  type="multiselect"
                  options={uniqueSyncedByOptions}
                  value={columnFilters.synced_by}
                  onChange={(val) => setColumnFilters(prev => ({ ...prev, synced_by: val }))}
                />
              </div>

              {/* Actions Header */}
              {canManage && <div role="columnheader" style={{ textAlign: 'right' }}>Actions</div>}
            </div>

            {/* Data Rows Container */}
            <div role="rowgroup">
              {filteredSessions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                  No sessions found.
                </div>
              ) : (
                filteredSessions.map(session => (
                  <div key={session.id} className="grid-table-row" style={gridColumnsStyle} role="row">
                    {/* Column 1: Event Name */}
                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Event Name</span>
                      <button
                        onClick={() => handleViewAttendees(session)}
                        className="btn-link"
                        title="Click to view attendees"
                      >
                        {session.event_name}
                      </button>
                    </div>

                    {/* Column 2: Date */}
                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Date</span>
                      <span>{session.event_date}</span>
                    </div>

                    {/* Column 3: Status */}
                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Status</span>
                      <div>{renderStatus(session)}</div>
                    </div>

                    {/* Column 4: Synced By */}
                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Synced By</span>
                      <span>
                        {session.synced_by ? (usersMap[session.synced_by] || ('User ' + session.synced_by.substring(0, 8) + '...')) : '-'}
                      </span>
                    </div>

                    {/* Column 5: Actions */}
                    {canManage && (
                      <div className="grid-table-cell" role="cell" style={{ justifyContent: 'flex-end' }}>
                        <span className="grid-table-label">Actions</span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filter & Sort Bottom Sheet */}
      {isMobileSheetOpen && (
        <div className="filter-sheet-overlay" onClick={() => setIsMobileSheetOpen(false)}>
          <div className="filter-sheet" onClick={e => e.stopPropagation()}>
            <div className="filter-sheet-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Filter & Sort Sessions</h3>
              <button
                type="button"
                className="filter-popover-close"
                onClick={() => setIsMobileSheetOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="filter-sheet-body">
              {/* Sort Options */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-primary)' }}>Sort By</h4>
                <select
                  value={sortConfig.key ? `${sortConfig.key}_${sortConfig.direction}` : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setSortConfig(defaultSort);
                    } else {
                      const [key, direction] = val.split('_');
                      setSortConfig({ key, direction });
                    }
                  }}
                  className="filter-input"
                >
                  <option value="">Default (None)</option>
                  <option value="event_name_asc">Event Name (A to Z)</option>
                  <option value="event_name_desc">Event Name (Z to A)</option>
                  <option value="event_date_desc">Date (Newest first)</option>
                  <option value="event_date_asc">Date (Oldest first)</option>
                  <option value="status_asc">Status (Pending → Ended → Synced)</option>
                  <option value="status_desc">Status (Synced → Ended → Pending)</option>
                  <option value="synced_by_asc">Synced By (A to Z)</option>
                  <option value="synced_by_desc">Synced By (Z to A)</option>
                </select>
              </div>

              {/* Event Name Filter */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-primary)' }}>Event Name</h4>
                <input
                  type="text"
                  placeholder="Filter event name..."
                  value={columnFilters.event_name}
                  onChange={e => setColumnFilters(prev => ({ ...prev, event_name: e.target.value }))}
                  className="filter-input"
                />
              </div>

              {/* Date Filter */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-primary)' }}>Date Range</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>From:</label>
                    <input
                      type="date"
                      value={columnFilters.event_date?.from || ''}
                      onChange={e => setColumnFilters(prev => ({ ...prev, event_date: { ...prev.event_date, from: e.target.value } }))}
                      className="filter-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>To:</label>
                    <input
                      type="date"
                      value={columnFilters.event_date?.to || ''}
                      onChange={e => setColumnFilters(prev => ({ ...prev, event_date: { ...prev.event_date, to: e.target.value } }))}
                      className="filter-input"
                    />
                  </div>
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-primary)' }}>Status</h4>
                <div className="filter-multiselect-list">
                  {uniqueStatusOptions.map(opt => {
                    const checked = columnFilters.status.includes(opt.value);
                    return (
                      <label key={opt.value} className="filter-multiselect-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setColumnFilters(prev => {
                              const curr = prev.status || [];
                              const next = curr.includes(opt.value)
                                ? curr.filter(v => v !== opt.value)
                                : [...curr, opt.value];
                              return { ...prev, status: next };
                            });
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Synced By Filter */}
              {uniqueSyncedByOptions.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-primary)' }}>Synced By</h4>
                  <div className="filter-multiselect-list">
                    {uniqueSyncedByOptions.map(opt => {
                      const checked = columnFilters.synced_by.includes(opt.value);
                      return (
                        <label key={opt.value} className="filter-multiselect-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setColumnFilters(prev => {
                                const curr = prev.synced_by || [];
                                const next = curr.includes(opt.value)
                                  ? curr.filter(v => v !== opt.value)
                                  : [...curr, opt.value];
                                return { ...prev, synced_by: next };
                              });
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

            <div className="filter-sheet-footer">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={handleClearAll}
              >
                Clear All
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setIsMobileSheetOpen(false)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendee Details Modal */}
      <Modal
        isOpen={!!selectedSessionModal}
        onClose={() => setSelectedSessionModal(null)}
        title={selectedSessionModal?.event_name || 'Session Attendees'}
        minHeight="550px"
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
              storageKey="session-attendees"
            />
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button onClick={() => setSelectedSessionModal(null)} className="btn btn-secondary">
            Close
          </button>
        </div>
      </Modal>

      {/* Start New Session Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Start New Session"
        maxWidth="450px"
      >
        <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Event Name:</label>
            <input 
              type="text" 
              placeholder="e.g. Troop Meeting, Campout, Service Project" 
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--foreground)',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Event Date:</label>
            <input 
              type="date" 
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--foreground)',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" disabled={creatingSession} className="btn btn-primary" style={{ flex: 1 }}>
              {creatingSession ? 'Starting...' : 'Start Session'}
            </button>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
