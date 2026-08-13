import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FilterPopover } from './common/FilterPopover';
import { useToast } from './common/ToastContext';
import { useConfirm } from './common/ConfirmContext';

export function InviteStatusList({ troopId, highlightedEmail, refreshKey }) {
  const { addToast } = useToast();
  const confirm = useConfirm();

  // Collapsible section state
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('tlc_invite_status_section_open');
      return saved !== 'false';
    } catch (_) {
      return true;
    }
  });

  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('tlc_invite_status_section_open', String(isOpen));
    } catch (_) { }
  }, [isOpen]);

  useEffect(() => {
    if (!troopId) return;
    fetchInvites();
  }, [troopId, refreshKey, highlightedEmail]);

  async function fetchInvites() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pending_invites')
        .select('*')
        .eq('troop_id', troopId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(item => ({
        id: item.id,
        email: item.email,
        role: item.role === 'troop_admin' ? 'Troop Admin' : item.role === 'roster_manager' ? 'Roster Manager' : 'Badge Scanner',
        status: new Date(item.expires_at) < new Date() ? 'Expired' : 'Invited',
        sent_at: item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'
      }));

      setInvites(formatted);
    } catch (err) {
      console.error('Error fetching pending invites:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteInvite = async (id, email) => {
    const isConfirmed = await confirm({
      title: 'Revoke Invitation',
      message: `Are you sure you want to revoke the invite for ${email}?`,
      confirmText: 'Revoke',
      isDestructive: true,
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('pending_invites')
        .delete()
        .eq('id', id);

      if (error) throw error;

      addToast('Invitation revoked.', 'success');
      fetchInvites();
    } catch (err) {
      console.error('Error revoking invite:', err);
      addToast('Failed to revoke invitation.', 'error');
    }
  };

  // Search & Filter & Sort state
  const [search, setSearch] = useState('');
  const [activePopover, setActivePopover] = useState(null);

  const defaultFilters = { email: [], role: [], status: [], sent_at: [] };
  const defaultSort = { key: null, direction: 'asc' };
  const defaultColumnWidths = useMemo(() => ({ email: 2.0, role: 1.2, status: 1.0, sent_at: 1.5, actions: 0.6 }), []);

  const [columnFilters, setColumnFilters] = useState(defaultFilters);
  const [sortConfig, setSortConfig] = useState(defaultSort);
  const [columnWidths, setColumnWidths] = useState(defaultColumnWidths);

  // Column resize logic
  const headerRef = useRef(null);
  const colKeys = useMemo(() => ['email', 'role', 'status', 'sent_at', 'actions'], []);

  const gridTemplateStyle = useMemo(() => {
    const colTracks = colKeys.map(k => `minmax(0, ${columnWidths[k] ?? defaultColumnWidths[k] ?? 1}fr)`).join(' ');
    return { gridTemplateColumns: colTracks };
  }, [colKeys, columnWidths, defaultColumnWidths]);

  const handleStartResize = (e, leftCol, rightCol) => {
    e.preventDefault();
    e.stopPropagation();
    if (!headerRef.current) return;

    const containerRect = headerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startLeftFr = columnWidths[leftCol] ?? defaultColumnWidths[leftCol] ?? 1;
    const startRightFr = columnWidths[rightCol] ?? defaultColumnWidths[rightCol] ?? 1;
    const totalFr = colKeys.reduce((sum, k) => sum + (columnWidths[k] ?? defaultColumnWidths[k] ?? 1), 0);
    const availWidth = containerRect.width;

    const handleMouseMove = (moveEv) => {
      const deltaX = moveEv.clientX - startX;
      const deltaFr = (deltaX / availWidth) * totalFr;
      const minFr = 0.5;
      let newLeftFr = startLeftFr + deltaFr;
      let newRightFr = startRightFr - deltaFr;
      if (newLeftFr < minFr) { newLeftFr = minFr; newRightFr = startLeftFr + startRightFr - minFr; }
      else if (newRightFr < minFr) { newRightFr = minFr; newLeftFr = startLeftFr + startRightFr - minFr; }
      setColumnWidths(prev => ({
        ...prev,
        [leftCol]: Number(newLeftFr.toFixed(2)),
        [rightCol]: Number(newRightFr.toFixed(2)),
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

  // Filter calculation
  const getFilteredInvites = (excludeColumn = null) => {
    let result = [...invites];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(inv =>
        inv.email.toLowerCase().includes(q) ||
        inv.role.toLowerCase().includes(q) ||
        inv.status.toLowerCase().includes(q) ||
        inv.sent_at.toLowerCase().includes(q)
      );
    }

    if (excludeColumn !== 'email' && columnFilters.email?.length > 0) {
      result = result.filter(inv => columnFilters.email.includes(inv.email));
    }
    if (excludeColumn !== 'role' && columnFilters.role?.length > 0) {
      result = result.filter(inv => columnFilters.role.includes(inv.role));
    }
    if (excludeColumn !== 'status' && columnFilters.status?.length > 0) {
      result = result.filter(inv => columnFilters.status.includes(inv.status));
    }
    if (excludeColumn !== 'sent_at' && columnFilters.sent_at?.length > 0) {
      result = result.filter(inv => columnFilters.sent_at.includes(inv.sent_at));
    }

    return result;
  };

  const processedInvites = useMemo(() => {
    let result = getFilteredInvites(null);
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = String(a[sortConfig.key] || '').toLowerCase();
        let valB = String(b[sortConfig.key] || '').toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [invites, search, columnFilters, sortConfig]);

  // Options & available options
  const uniqueEmails = useMemo(() => [...new Set(invites.map(i => i.email))].sort(), [invites]);
  const uniqueRoles = useMemo(() => [...new Set(invites.map(i => i.role))].sort(), [invites]);
  const uniqueStatuses = useMemo(() => [...new Set(invites.map(i => i.status))].sort(), [invites]);
  const uniqueSentAts = useMemo(() => [...new Set(invites.map(i => i.sent_at))].sort(), [invites]);

  const availableEmails = useMemo(() => new Set(getFilteredInvites('email').map(i => i.email)), [invites, search, columnFilters]);
  const availableRoles = useMemo(() => new Set(getFilteredInvites('role').map(i => i.role)), [invites, search, columnFilters]);
  const availableStatuses = useMemo(() => new Set(getFilteredInvites('status').map(i => i.status)), [invites, search, columnFilters]);
  const availableSentAts = useMemo(() => new Set(getFilteredInvites('sent_at').map(i => i.sent_at)), [invites, search, columnFilters]);

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips = [];
    if (columnFilters.email?.length > 0) {
      const label = columnFilters.email.length > 2 ? `${columnFilters.email.length} selected` : columnFilters.email.join(', ');
      chips.push({ id: 'email', label: `Email: ${label}`, onRemove: () => setColumnFilters(p => ({ ...p, email: [] })) });
    }
    if (columnFilters.role?.length > 0) {
      const label = columnFilters.role.length > 2 ? `${columnFilters.role.length} selected` : columnFilters.role.join(', ');
      chips.push({ id: 'role', label: `Role: ${label}`, onRemove: () => setColumnFilters(p => ({ ...p, role: [] })) });
    }
    if (columnFilters.status?.length > 0) {
      const label = columnFilters.status.length > 2 ? `${columnFilters.status.length} selected` : columnFilters.status.join(', ');
      chips.push({ id: 'status', label: `Status: ${label}`, onRemove: () => setColumnFilters(p => ({ ...p, status: [] })) });
    }
    if (columnFilters.sent_at?.length > 0) {
      const label = columnFilters.sent_at.length > 2 ? `${columnFilters.sent_at.length} selected` : columnFilters.sent_at.join(', ');
      chips.push({ id: 'sent_at', label: `Sent At: ${label}`, onRemove: () => setColumnFilters(p => ({ ...p, sent_at: [] })) });
    }
    return chips;
  }, [columnFilters]);

  const handleClearAll = () => {
    setColumnFilters(defaultFilters);
    setSortConfig(defaultSort);
    setSearch('');
  };

  const getStatusBadge = (status) => {
    if (status === 'Accepted') return <span className="badge badge-success">Accepted</span>;
    if (status === 'Expired') return <span className="badge badge-destructive" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>Expired</span>;
    return <span className="badge badge-neutral">Invited</span>;
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Section Header */}
      <div
        className="attendance-section-header"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setIsOpen(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
            Pending Invitations ({processedInvites.length})
          </h3>
        </div>
      </div>

      {isOpen && (
        <div className="glass-card" style={{ padding: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
          {/* Toolbar: Search + Clear All */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search invites..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem 0.625rem 2.25rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--foreground)',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                🔍
              </span>
            </div>
            {(activeChips.length > 0 || sortConfig.key || search) && (
              <button type="button" className="btn-link" onClick={handleClearAll} style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                Clear all filters
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Filters:</span>
              {activeChips.map(chip => (
                <div key={chip.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--muted)', color: 'var(--foreground)', fontSize: '0.8rem', fontWeight: 500 }}>
                  <span>{chip.label}</span>
                  <button type="button" onClick={chip.onRemove} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, padding: 0 }} title="Remove filter">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Grid Table */}
          <div className="grid-table-container" style={{ width: '100%', boxSizing: 'border-box' }}>
            {/* Header */}
            <div ref={headerRef} className="grid-table-header no-manage" role="row" style={gridTemplateStyle}>
              {/* Email */}
              <div role="columnheader" className="column-header-cell" style={{ position: 'relative' }}>
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'email' ? null : 'email')}>
                  Email
                  {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.email?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'email' && (
                  <FilterPopover
                    isOpen={true} title="Email" type="multiselect"
                    options={uniqueEmails.map(e => ({ label: e, value: e, disabled: !availableEmails.has(e) }))}
                    value={columnFilters.email || []}
                    onChange={val => setColumnFilters(p => ({ ...p, email: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig} columnKey="email"
                    onSort={dir => setSortConfig({ key: 'email', direction: dir })}
                    sortAscLabel="Sort A to Z" sortDescLabel="Sort Z to A"
                  />
                )}
                <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'email', 'role')} title="Drag to resize column" />
              </div>

              {/* Role */}
              <div role="columnheader" className="column-header-cell" style={{ position: 'relative' }}>
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'role' ? null : 'role')}>
                  Role
                  {sortConfig.key === 'role' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.role?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'role' && (
                  <FilterPopover
                    isOpen={true} title="Role" type="multiselect"
                    options={uniqueRoles.map(r => ({ label: r, value: r, disabled: !availableRoles.has(r) }))}
                    value={columnFilters.role || []}
                    onChange={val => setColumnFilters(p => ({ ...p, role: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig} columnKey="role"
                    onSort={dir => setSortConfig({ key: 'role', direction: dir })}
                    sortAscLabel="Sort A to Z" sortDescLabel="Sort Z to A"
                  />
                )}
                <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'role', 'status')} title="Drag to resize column" />
              </div>

              {/* Status */}
              <div role="columnheader" className="column-header-cell" style={{ position: 'relative' }}>
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}>
                  Status
                  {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.status?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'status' && (
                  <FilterPopover
                    isOpen={true} title="Status" type="multiselect"
                    options={uniqueStatuses.map(s => ({ label: s, value: s, disabled: !availableStatuses.has(s) }))}
                    value={columnFilters.status || []}
                    onChange={val => setColumnFilters(p => ({ ...p, status: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig} columnKey="status"
                    onSort={dir => setSortConfig({ key: 'status', direction: dir })}
                    sortAscLabel="Sort A to Z" sortDescLabel="Sort Z to A"
                  />
                )}
                <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'status', 'sent_at')} title="Drag to resize column" />
              </div>

              {/* Sent At */}
              <div role="columnheader" className="column-header-cell" style={{ position: 'relative' }}>
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'sent_at' ? null : 'sent_at')}>
                  Sent At
                  {sortConfig.key === 'sent_at' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.sent_at?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'sent_at' && (
                  <FilterPopover
                    isOpen={true} title="Sent At" type="multiselect"
                    options={uniqueSentAts.map(s => ({ label: s, value: s, disabled: !availableSentAts.has(s) }))}
                    value={columnFilters.sent_at || []}
                    onChange={val => setColumnFilters(p => ({ ...p, sent_at: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig} columnKey="sent_at"
                    onSort={dir => setSortConfig({ key: 'sent_at', direction: dir })}
                    sortAscLabel="Sort Oldest to Newest" sortDescLabel="Sort Newest to Oldest"
                  />
                )}
                <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'sent_at', 'actions')} title="Drag to resize column" />
              </div>

              {/* Actions Header */}
              <div role="columnheader" className="column-header-cell" style={{ justifyContent: 'center' }}>
                <span className="column-header-btn" style={{ cursor: 'default' }}>Actions</span>
              </div>
            </div>

            {/* Rows */}
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading pending invites...
              </div>
            ) : processedInvites.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No pending invitations{activeChips.length > 0 || search ? ' matching your filters' : ''}.
              </div>
            ) : (
              processedInvites.map(item => {
                const isHighlighted = highlightedEmail && item.email.toLowerCase() === highlightedEmail.toLowerCase();
                return (
                  <div
                    key={item.id}
                    className={`grid-table-row no-manage ${isHighlighted ? 'row-highlight-error' : ''}`}
                    role="row"
                    style={gridTemplateStyle}
                  >
                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Email</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--foreground)', fontWeight: isHighlighted ? 600 : 400 }}>
                        {item.email}
                      </span>
                    </div>

                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Role</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>{item.role}</span>
                    </div>

                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Status</span>
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Sent At</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.sent_at}</span>
                    </div>

                    <div className="grid-table-cell" role="cell" style={{ justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteInvite(item.id, item.email)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-danger, #ef4444)',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-sm)'
                        }}
                        title="Revoke invitation"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

