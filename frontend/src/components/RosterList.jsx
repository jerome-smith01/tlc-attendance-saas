import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { parseTlcRosterCsv } from '../utils/csvParser';
import { Modal } from './common/Modal';
import { FilterPopover } from './common/FilterPopover';
import { InviteUser } from './InviteUser';
import { InviteStatusList } from './InviteStatusList';
import { useToast } from './common/ToastContext';
import { useConfirm } from './common/ConfirmContext';
import { SingleBadgeScannerModal } from './SingleBadgeScannerModal';

export function RosterList({ troopId, currentUserRole, currentUserId, isGlobalAdmin, activeTab, userId }) {
  const navigate = useNavigate();

  // ── Permission check FIRST (before any hooks that depend on it) ──────────
  const canManageRoster = isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin';

  const { addToast } = useToast();
  const confirm = useConfirm();

  // ── Data state ────────────────────────────────────────────────────────────
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  // Storage keys for section visibility persistence
  const tableVisibilityKey = `tlc_section_roster_table_${userId || 'anon'}`;
  const csvVisibilityKey = `tlc_section_roster_csv_${userId || 'anon'}`;

  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showActionGuide, setShowActionGuide] = useState(false);
  const [isTableVisible, setIsTableVisible] = useState(() => {
    try {
      const saved = localStorage.getItem(tableVisibilityKey);
      if (saved !== null) return JSON.parse(saved);
    } catch (_) { }
    return true;
  });
  const [isCsvVisible, setIsCsvVisible] = useState(() => {
    try {
      const saved = localStorage.getItem(csvVisibilityKey);
      if (saved !== null) return JSON.parse(saved);
    } catch (_) { }
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem(tableVisibilityKey, JSON.stringify(isTableVisible));
    } catch (_) { }
  }, [isTableVisible, tableVisibilityKey]);

  useEffect(() => {
    try {
      localStorage.setItem(csvVisibilityKey, JSON.stringify(isCsvVisible));
    } catch (_) { }
  }, [isCsvVisible, csvVisibilityKey]);

  const [selectedFileName, setSelectedFileName] = useState('');
  const fileInputRef = useRef(null);

  // ── Add Member modal state (Members tab) ──────────────────────────────────
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastInitial, setNewLastInitial] = useState('');
  const [newMemberId, setNewMemberId] = useState('');

  // ── Single Badge Scanner modal state ──────────────────────────────────────
  const [scanningMember, setScanningMember] = useState(null);
  const [recentlyScannedIds, setRecentlyScannedIds] = useState(new Set());

  const triggerRowHighlight = (id) => {
    setRecentlyScannedIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setRecentlyScannedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  };

  const handleScanSingleBadge = async (scanData) => {
    if (!scanningMember) return;
    const { tlcId, memberId } = typeof scanData === 'string' 
      ? { tlcId: scanData, memberId: null } 
      : scanData;

    const memberDisplayName = scanningMember.name || `${scanningMember.first_name || ''} ${scanningMember.last_initial || ''}`.trim();

    try {
      let updateData = { tlc_id: tlcId };
      if (memberId) {
        updateData.member_id = memberId;
      }

      let { error } = await supabase.from('roster').update(updateData).eq('id', scanningMember.id);

      // If update with member_id failed due to duplicate key constraint (23505), try updating tlc_id alone
      if (error && error.code === '23505' && memberId) {
        updateData = { tlc_id: tlcId };
        const retry = await supabase.from('roster').update(updateData).eq('id', scanningMember.id);
        error = retry.error;
      }

      if (error) {
        if (error.code === '23505') {
          const existingMember = roster.find(m => m.tlc_id === tlcId && m.id !== scanningMember.id);
          const existingName = existingMember 
            ? (existingMember.name || `${existingMember.first_name || ''} ${existingMember.last_initial || ''}`.trim())
            : null;

          const duplicateMessage = existingName
            ? `This badge is already linked to ${existingName}.`
            : 'This badge is already linked to another member in your troop.';

          setScanningMember(null);
          await confirm({
            title: 'Duplicate Badge',
            message: duplicateMessage,
            confirmText: 'OK',
            cancelText: null
          });
          return;
        }
        throw error;
      }

      setRoster(prev => prev.map(m => m.id === scanningMember.id ? { ...m, ...updateData } : m));
      triggerRowHighlight(scanningMember.id);
      addToast(`Successfully linked badge for ${memberDisplayName}`, 'success');
    } catch (err) {
      console.error('Error linking badge', err);
      addToast('Failed to link badge. Please try again.', 'error');
    }
    setScanningMember(null);
  };

  // ── Filter / Sort / Column width state (per-user localStorage) ────────────
  const storageKey = `tlc_table_roster_${userId || 'anon'}`;

  const defaultFilters = {
    name: [],
    role: [],
    email: [],
    member_id: [],
    badge: [],
    actions: [],
  };
  const defaultSort = { key: null, direction: 'asc' };

  // Per-tab default column widths
  const defaultColumnWidthsLeaders = useMemo(() => ({
    name: 2.0, role: 1.0, email: 1.5, member_id: 1.0, badge: 1.0, actions: 1.2
  }), []);
  const defaultColumnWidthsMembers = useMemo(() => ({
    name: 3.0, member_id: 1.0, badge: 1.0, actions: 1.2
  }), []);

  const defaultColumnWidths = activeTab === 'leaders' ? defaultColumnWidthsLeaders : defaultColumnWidthsMembers;

  const [activePopover, setActivePopover] = useState(null);
  const [rosterSearch, setRosterSearch] = useState('');

  const [sortConfig, setSortConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { const p = JSON.parse(saved); if (p.sortConfig) return p.sortConfig; }
    } catch (_) { }
    return defaultSort;
  });

  const [columnFilters, setColumnFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { const p = JSON.parse(saved); if (p.columnFilters) return { ...defaultFilters, ...p.columnFilters }; }
    } catch (_) { }
    return defaultFilters;
  });

  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { const p = JSON.parse(saved); if (p.columnWidths) return { ...defaultColumnWidths, ...p.columnWidths }; }
    } catch (_) { }
    return defaultColumnWidths;
  });

  // Persist state on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sortConfig, columnFilters, columnWidths }));
    } catch (_) { }
  }, [sortConfig, columnFilters, columnWidths, storageKey]);

  // ── Column resize ─────────────────────────────────────────────────────────
  const headerRef = useRef(null);

  // Active columns for the current tab
  const activeColKeys = useMemo(() => {
    if (activeTab === 'leaders') {
      return canManageRoster
        ? ['name', 'role', 'email', 'member_id', 'badge', 'actions']
        : ['name', 'role', 'email', 'member_id', 'badge'];
    }
    return canManageRoster
      ? ['name', 'member_id', 'badge', 'actions']
      : ['name', 'member_id', 'badge'];
  }, [activeTab, canManageRoster]);

  const gridTemplateStyle = useMemo(() => {
    const checkboxTrack = canManageRoster ? '48px ' : '';
    const colTracks = activeColKeys.map(k => `minmax(0, ${columnWidths[k] ?? defaultColumnWidths[k] ?? 1}fr)`).join(' ');
    return { gridTemplateColumns: `${checkboxTrack}${colTracks}` };
  }, [canManageRoster, activeColKeys, columnWidths, defaultColumnWidths]);

  const handleStartResize = (e, leftCol, rightCol) => {
    e.preventDefault();
    e.stopPropagation();
    if (!headerRef.current) return;

    const containerRect = headerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startLeftFr = columnWidths[leftCol] ?? defaultColumnWidths[leftCol] ?? 1;
    const startRightFr = columnWidths[rightCol] ?? defaultColumnWidths[rightCol] ?? 1;
    const totalFr = activeColKeys.reduce((sum, k) => sum + (columnWidths[k] ?? defaultColumnWidths[k] ?? 1), 0);
    const availWidth = canManageRoster ? Math.max(100, containerRect.width - 48) : containerRect.width;

    const handleMouseMove = (moveEv) => {
      const deltaX = moveEv.clientX - startX;
      const deltaFr = (deltaX / availWidth) * totalFr;
      const minFr = 0.4;
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

  const toast = useToast();

  // ── Data fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (troopId) {
      fetchRoster();
    } else {
      setRoster([]);
      setSelectedMembers([]);
      setLoading(false);
    }
  }, [troopId]);

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedMembers([]);
    setActivePopover(null);
  }, [activeTab]);

  async function fetchRoster() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('roster')
        .select('*')
        .eq('troop_id', troopId)
        .order('first_name');
      if (error) throw error;
      setRoster(data || []);
      setSelectedMembers(prev => prev.filter(id => (data || []).some(m => m.id === id)));
    } catch (err) {
      console.error('Error fetching roster:', err);
      toast('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Tab-filtered base list ────────────────────────────────────────────────
  const displayRoster = useMemo(() => roster.filter(member => {
    if (member.role === 'global_admin') return false;
    if (activeTab === 'leaders') return member.role !== null && member.role !== 'trailman';
    return member.role === null || member.role === 'trailman';
  }), [roster, activeTab]);

  // ── Filter & Sort ─────────────────────────────────────────────────────────
  const getMemberName = (m) => `${m.first_name} ${m.last_initial}.`;
  const getMemberRole = (m) => m.role ? m.role.replace(/_/g, ' ') : 'trailman';
  const getBadgeLabel = (m) => m.tlc_id ? 'View' : 'Scan Badge';

  const getFilteredRoster = (excludeColumn = null) => {
    let result = [...displayRoster];

    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase().trim();
      result = result.filter(m =>
        getMemberName(m).toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.member_id || '').toLowerCase().includes(q) ||
        getMemberRole(m).toLowerCase().includes(q)
      );
    }

    if (excludeColumn !== 'name' && columnFilters.name?.length > 0) {
      result = result.filter(m => columnFilters.name.includes(getMemberName(m)));
    }
    if (excludeColumn !== 'role' && columnFilters.role?.length > 0) {
      result = result.filter(m => columnFilters.role.includes(getMemberRole(m)));
    }
    if (excludeColumn !== 'email' && columnFilters.email?.length > 0) {
      result = result.filter(m => columnFilters.email.includes(m.email || ''));
    }
    if (excludeColumn !== 'member_id' && columnFilters.member_id?.length > 0) {
      result = result.filter(m => columnFilters.member_id.includes(m.member_id || ''));
    }
    if (excludeColumn !== 'badge' && columnFilters.badge?.length > 0) {
      result = result.filter(m => columnFilters.badge.includes(getBadgeLabel(m)));
    }

    return result;
  };

  const processedRoster = useMemo(() => {
    let result = getFilteredRoster(null);
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = '', valB = '';
        if (sortConfig.key === 'name') { valA = getMemberName(a); valB = getMemberName(b); }
        else if (sortConfig.key === 'role') { valA = getMemberRole(a); valB = getMemberRole(b); }
        else if (sortConfig.key === 'badge') { valA = getBadgeLabel(a); valB = getBadgeLabel(b); }
        else { valA = a[sortConfig.key] || ''; valB = b[sortConfig.key] || ''; }
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [displayRoster, rosterSearch, columnFilters, sortConfig]);

  // Cross-column available options
  const availableNames = useMemo(() => new Set(getFilteredRoster('name').map(m => getMemberName(m))), [displayRoster, rosterSearch, columnFilters]);
  const availableRoles = useMemo(() => new Set(getFilteredRoster('role').map(m => getMemberRole(m))), [displayRoster, rosterSearch, columnFilters]);
  const availableEmails = useMemo(() => new Set(getFilteredRoster('email').map(m => m.email).filter(Boolean)), [displayRoster, rosterSearch, columnFilters]);
  const availableMemberIds = useMemo(() => new Set(getFilteredRoster('member_id').map(m => m.member_id).filter(Boolean)), [displayRoster, rosterSearch, columnFilters]);
  const availableBadges = useMemo(() => new Set(getFilteredRoster('badge').map(m => getBadgeLabel(m))), [displayRoster, rosterSearch, columnFilters]);

  // Unique option lists
  const uniqueNames = useMemo(() => [...new Set(displayRoster.map(m => getMemberName(m)))].sort(), [displayRoster]);
  const uniqueRoles = useMemo(() => [...new Set(displayRoster.map(m => getMemberRole(m)))].sort(), [displayRoster]);
  const uniqueEmails = useMemo(() => [...new Set(displayRoster.map(m => m.email).filter(Boolean))].sort(), [displayRoster]);
  const uniqueMemberIds = useMemo(() => [...new Set(displayRoster.map(m => m.member_id).filter(Boolean))].sort(), [displayRoster]);

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips = [];
    if (columnFilters.name?.length > 0) {
      const label = columnFilters.name.length > 2 ? `${columnFilters.name.length} selected` : columnFilters.name.join(', ');
      chips.push({ id: 'name', label: `Name: ${label.length > 50 ? label.slice(0, 50) + '...' : label}`, onRemove: () => setColumnFilters(p => ({ ...p, name: [] })) });
    }
    if (columnFilters.role?.length > 0) {
      const label = columnFilters.role.length > 2 ? `${columnFilters.role.length} selected` : columnFilters.role.join(', ');
      chips.push({ id: 'role', label: `Role: ${label}`, onRemove: () => setColumnFilters(p => ({ ...p, role: [] })) });
    }
    if (columnFilters.email?.length > 0) {
      const label = columnFilters.email.length > 2 ? `${columnFilters.email.length} selected` : columnFilters.email.join(', ');
      chips.push({ id: 'email', label: `Email: ${label.length > 50 ? label.slice(0, 50) + '...' : label}`, onRemove: () => setColumnFilters(p => ({ ...p, email: [] })) });
    }
    if (columnFilters.member_id?.length > 0) {
      const label = columnFilters.member_id.length > 2 ? `${columnFilters.member_id.length} selected` : columnFilters.member_id.join(', ');
      chips.push({ id: 'member_id', label: `Member ID: ${label}`, onRemove: () => setColumnFilters(p => ({ ...p, member_id: [] })) });
    }
    if (columnFilters.badge?.length > 0) {
      chips.push({ id: 'badge', label: `Badge: ${columnFilters.badge.join(', ')}`, onRemove: () => setColumnFilters(p => ({ ...p, badge: [] })) });
    }
    return chips;
  }, [columnFilters]);

  const handleClearAll = () => {
    setColumnFilters(defaultFilters);
    setSortConfig(defaultSort);
    setRosterSearch('');
  };

  const handleSortToggle = (key) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: 'asc' };
    });
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const selectableRoster = useMemo(() => processedRoster.filter(m => m.user_id !== currentUserId), [processedRoster, currentUserId]);
  const isAllSelected = useMemo(() => selectableRoster.length > 0 && selectableRoster.every(m => selectedMembers.includes(m.id)), [selectableRoster, selectedMembers]);
  const isSomeSelected = useMemo(() => selectableRoster.some(m => selectedMembers.includes(m.id)) && !isAllSelected, [selectableRoster, selectedMembers, isAllSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) { setSelectedMembers([]); }
    else { setSelectedMembers(selectableRoster.map(m => m.id)); }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleAddMember(e) {
    e.preventDefault();
    if (!newFirstName || !newLastInitial) return;
    try {
      const { error } = await supabase.from('roster').insert([{
        troop_id: troopId,
        first_name: newFirstName,
        last_initial: newLastInitial.toUpperCase(),
        member_id: newMemberId || null,
      }]);
      if (error) throw error;
      setNewFirstName(''); setNewLastInitial(''); setNewMemberId('');
      setIsAddMemberModalOpen(false);
      fetchRoster();
      toast('Member added successfully', 'success');
    } catch (err) {
      console.error('Error adding member:', err);
      toast('Something went wrong. Please try again.', 'error');
    }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFileName(file.name);
    try {
      setLoading(true);
      const parsedMembers = await parseTlcRosterCsv(file);
      if (parsedMembers.length === 0) {
        throw new Error('No valid members found in CSV. Make sure it contains First Name, Last Name, and Member Number.');
      }
      const membersToInsert = parsedMembers.map(m => ({ ...m, troop_id: troopId }));
      const { error } = await supabase.from('roster').upsert(membersToInsert, { onConflict: 'troop_id, member_id', ignoreDuplicates: true });
      if (error) throw error;
      fetchRoster();
      toast(`Successfully processed ${parsedMembers.length} members from CSV.`, 'success');
    } catch (err) {
      console.error('Error uploading CSV:', err);
      toast(err.message, 'error');
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  }

  async function handleBulkRemove() {
    if (!await confirm({ title: 'Remove Members', message: `Are you sure you want to remove ${selectedMembers.length} member(s)?`, isDestructive: true })) return;
    try {
      const { error } = await supabase.from('roster').delete().in('id', selectedMembers);
      if (error) throw error;
      setSelectedMembers([]);
      fetchRoster();
      toast('Members removed successfully', 'success');
    } catch (err) {
      console.error('Error deleting members:', err);
      toast('Something went wrong. Please try again.', 'error');
    }
  }

  async function handleBulkCopy() {
    const selectedData = roster.filter(m => selectedMembers.includes(m.id));
    const header = 'Name\tRole\tEmail\tMember ID\tProfile\n';
    const tsv = selectedData.map(m =>
      `${getMemberName(m)}\t${getMemberRole(m)}\t${m.email || ''}\t${m.member_id || ''}\t${m.tlc_id ? 'https://www.traillifeconnect.com/profile/' + m.tlc_id + '/overview' : 'Not Linked'}`
    ).join('\n');
    try {
      await navigator.clipboard.writeText(header + tsv);
      toast('Copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy', err);
      toast('Failed to copy to clipboard', 'error');
    }
  }

  function handleEditMember(member) {
    navigate(`/roster/${member.id}/edit`);
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading roster...</div>;

  const tabLabel = activeTab === 'leaders' ? 'Leaders' : 'Members';

  return (
    <div className="roster-list">

      {/* ── Leaders tab: Invite form & Invite Status ───────────────────── */}
      {activeTab === 'leaders' && (
        <>
          <InviteUser troopId={troopId} />
          <InviteStatusList troopId={troopId} />
        </>
      )}

      {/* ── Members tab: CSV import ────────────────────────────────────── */}
      {activeTab === 'members' && (
        <>
          <div className="attendance-section-header" style={{ marginBottom: '0.75rem' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsCsvVisible(v => !v)}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'transform 0.2s', transform: isCsvVisible ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
                Import from TLC CSV
              </h3>
            </div>
          </div>

          {isCsvVisible && (
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <ul style={{ margin: '0px 0px 0.75rem 0px', paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <li>
                  To export the roster from TLC, go to <a href="https://www.traillifeconnect.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Trail Life Connect</a> → My Troop → <a href="https://www.traillifeconnect.com/user" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Troop Members</a> → Export filtered to csv.
                </li>
                <li>
                  The app only uses First Name, Last Name, Member Number, and Nickname (if present).
                </li>
              </ul>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                disabled={!troopId || loading}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!troopId || loading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {loading ? 'Processing...' : 'Choose CSV File'}
                </button>
                <span style={{ fontSize: '0.875rem', color: selectedFileName ? 'var(--foreground)' : 'var(--text-secondary)', fontStyle: selectedFileName ? 'normal' : 'italic' }}>
                  {selectedFileName || 'No file chosen'}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Section header ─────────────────────────────────────────────── */}
      <div className="attendance-section-header">
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setIsTableVisible(v => !v)}
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.2s', transform: isTableVisible ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
            {tabLabel} ({processedRoster.length})
          </h3>
        </div>

        {/* Right side: Add Member button (Members tab) + master checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginRight: '4px' }}>
          {activeTab === 'members' && canManageRoster && (
            <button
              type="button"
              className="btn btn-start btn-compact"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onClick={() => { setNewFirstName(''); setNewLastInitial(''); setNewMemberId(''); setIsAddMemberModalOpen(true); }}
            >
              + Add Member
            </button>
          )}
          {canManageRoster && (
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={input => { if (input) input.indeterminate = isSomeSelected; }}
              onChange={handleToggleSelectAll}
              style={{ margin: 0, cursor: 'pointer', width: '18px', height: '18px' }}
              title="Select all visible members"
            />
          )}
        </div>
      </div>

      {isTableVisible && (
        <div className="glass-card" style={{ padding: '1.5rem', width: '100%', boxSizing: 'border-box' }}>

          {/* ── Toolbar: Search + Clear All ─────────────────────────────── */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <input
                type="text"
                placeholder={`Search ${tabLabel.toLowerCase()}...`}
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
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
            {(activeChips.length > 0 || sortConfig.key || rosterSearch) && (
              <button type="button" className="btn-link" onClick={handleClearAll} style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                Clear all filters
              </button>
            )}
          </div>

          {/* ── Active filter chips ─────────────────────────────────────── */}
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

          {/* ── Grid Table ─────────────────────────────────────────────── */}
          <div className={`grid-table-container ${selectedMembers.length > 0 ? 'has-bulk-selection' : ''}`} style={{ width: '100%', boxSizing: 'border-box' }}>

            {/* Desktop header */}
            <div ref={headerRef} className="grid-table-header" role="row" style={gridTemplateStyle}>

              {/* Select all checkbox */}
              {canManageRoster && (
                <div role="columnheader" className="column-header-cell grid-table-header-select">
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

              {/* Name */}
              <div role="columnheader" className="column-header-cell" style={{ position: 'relative' }}>
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'name' ? null : 'name')}>
                  Name
                  {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.name?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'name' && (
                  <FilterPopover
                    isOpen={true} title="Name" type="multiselect"
                    options={uniqueNames.map(n => ({ label: n, value: n, disabled: !availableNames.has(n) }))}
                    value={columnFilters.name || []}
                    onChange={val => setColumnFilters(p => ({ ...p, name: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig} columnKey="name"
                    onSort={dir => setSortConfig({ key: 'name', direction: dir })}
                    sortAscLabel="Sort A to Z" sortDescLabel="Sort Z to A"
                  />
                )}
                <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'name', activeTab === 'leaders' ? 'role' : 'member_id')} title="Drag to resize column" />
              </div>

              {/* Role (leaders only) */}
              {activeTab === 'leaders' && (
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
                  <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'role', 'email')} title="Drag to resize column" />
                </div>
              )}

              {/* Email (leaders only) */}
              {activeTab === 'leaders' && (
                <div role="columnheader" className="column-header-cell" style={{ position: 'relative' }}>
                  <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'email' ? null : 'email')}>
                    Email
                    {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                    {columnFilters.email?.length > 0 && ' 🌪️'}
                  </button>
                  {activePopover === 'email' && (
                    <FilterPopover
                      isOpen={true} title="Email" type="multiselect"
                      options={uniqueEmails.map(em => ({ label: em, value: em, disabled: !availableEmails.has(em) }))}
                      value={columnFilters.email || []}
                      onChange={val => setColumnFilters(p => ({ ...p, email: val }))}
                      onClose={() => setActivePopover(null)}
                      sortConfig={sortConfig} columnKey="email"
                      onSort={dir => setSortConfig({ key: 'email', direction: dir })}
                      sortAscLabel="Sort A to Z" sortDescLabel="Sort Z to A"
                    />
                  )}
                  <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'email', 'member_id')} title="Drag to resize column" />
                </div>
              )}

              {/* Member ID */}
              <div role="columnheader" className="column-header-cell" style={{ position: 'relative' }}>
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'member_id' ? null : 'member_id')}>
                  Member ID
                  {sortConfig.key === 'member_id' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.member_id?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'member_id' && (
                  <FilterPopover
                    isOpen={true} title="Member ID" type="multiselect"
                    options={uniqueMemberIds.map(id => ({ label: id, value: id, disabled: !availableMemberIds.has(id) }))}
                    value={columnFilters.member_id || []}
                    onChange={val => setColumnFilters(p => ({ ...p, member_id: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig} columnKey="member_id"
                    onSort={dir => setSortConfig({ key: 'member_id', direction: dir })}
                    sortAscLabel="Sort A to Z" sortDescLabel="Sort Z to A"
                  />
                )}
                <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'member_id', 'badge')} title="Drag to resize column" />
              </div>

              {/* Profile */}
              <div role="columnheader" className="column-header-cell" style={{ position: 'relative' }}>
                <button type="button" className="column-header-btn" onClick={() => setActivePopover(activePopover === 'badge' ? null : 'badge')}>
                  Profile
                  {sortConfig.key === 'badge' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                  {columnFilters.badge?.length > 0 && ' 🌪️'}
                </button>
                {activePopover === 'badge' && (
                  <FilterPopover
                    isOpen={true} title="Profile" type="multiselect"
                    options={[
                      { label: 'View', value: 'View', disabled: !availableBadges.has('View') },
                      { label: 'Scan Badge', value: 'Scan Badge', disabled: !availableBadges.has('Scan Badge') },
                    ]}
                    value={columnFilters.badge || []}
                    onChange={val => setColumnFilters(p => ({ ...p, badge: val }))}
                    onClose={() => setActivePopover(null)}
                    sortConfig={sortConfig} columnKey="badge"
                    onSort={dir => setSortConfig({ key: 'badge', direction: dir })}
                    sortAscLabel="View First" sortDescLabel="Scan Badge First"
                  />
                )}
                {canManageRoster && (
                  <div className="column-resizer" onMouseDown={e => handleStartResize(e, 'badge', 'actions')} title="Drag to resize column" />
                )}
              </div>

              {/* Actions header */}
              {canManageRoster && (
                <div role="columnheader" className="column-header-cell grid-table-header-actions">
                  <span className="column-header-btn" style={{ cursor: 'default' }}>Actions</span>
                </div>
              )}
            </div>

            {/* ── Rows ──────────────────────────────────────────────────── */}
            {processedRoster.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No {tabLabel.toLowerCase()} found{activeChips.length > 0 || rosterSearch ? ' matching your filters' : ''}.
              </div>
            ) : (
              processedRoster.map(member => {
                const isOwnRow = member.user_id === currentUserId;
                const canDelete = canManageRoster && !isOwnRow;
                const canEdit = canManageRoster;

                return (
                  <div
                    key={member.id}
                    id={`scan-row-${member.id}`}
                    className={`grid-table-row ${recentlyScannedIds.has(member.id) ? 'newly-scanned' : ''}`}
                    role="row"
                    style={gridTemplateStyle}
                  >
                    {/* Card header (mobile: checkbox + name + actions; desktop: display:contents) */}
                    <div className="grid-table-card-header">
                      {/* Checkbox */}
                      {canManageRoster && (
                        <div className="grid-table-cell grid-table-cell-select" role="cell">
                          {!isOwnRow ? (
                            <input
                              type="checkbox"
                              checked={selectedMembers.includes(member.id)}
                              onChange={() => handleToggleSelectRow(member.id)}
                              style={{ margin: 0, cursor: 'pointer', width: '18px', height: '18px', marginTop: '2px' }}
                              title="Select member"
                            />
                          ) : (
                            <span style={{ display: 'inline-block', width: '18px', height: '18px' }} />
                          )}
                        </div>
                      )}

                      {/* Name */}
                      <div className="grid-table-cell grid-table-cell-name" role="cell">
                        <span
                          style={{ fontWeight: 600, fontSize: '0.95rem', lineHeight: 1.4, display: 'block', wordBreak: 'break-word' }}
                        >
                          {getMemberName(member)}
                          {isOwnRow && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>(you)</span>
                          )}
                        </span>
                      </div>

                    </div>


                    {/* Role (leaders tab) */}
                    {activeTab === 'leaders' && (
                      <div className="grid-table-cell" role="cell">
                        <span className="grid-table-label">Role</span>
                        <span style={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>{getMemberRole(member)}</span>
                      </div>
                    )}

                    {/* Email (leaders tab) */}
                    {activeTab === 'leaders' && (
                      <div className="grid-table-cell" role="cell">
                        <span className="grid-table-label">Email</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{member.email || '—'}</span>
                      </div>
                    )}

                    {/* Member ID */}
                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Member ID</span>
                      <span style={{ fontSize: '0.875rem' }}>{member.member_id || '—'}</span>
                    </div>

                    {/* Profile */}
                    <div className="grid-table-cell" role="cell">
                      <span className="grid-table-label">Profile</span>
                      {member.tlc_id ? (
                        <a 
                          href={`https://www.traillifeconnect.com/profile/${member.tlc_id}/overview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="badge badge-success"
                          style={{ textDecoration: 'none' }}
                          title="View Profile on Trail Life Connect"
                        >
                          View
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="badge badge-neutral"
                          style={{ cursor: canManageRoster ? 'pointer' : 'default', border: 'none', fontFamily: 'inherit' }}
                          onClick={() => {
                            if (canManageRoster) {
                              setScanningMember({ id: member.id, name: getMemberName(member) });
                            }
                          }}
                          disabled={!canManageRoster}
                          title={canManageRoster ? 'Scan Badge' : 'Profile unavailable'}
                        >
                          Scan Badge
                        </button>
                      )}
                    </div>

                    {/* Actions (desktop — display:contents from card header unwraps these into grid) */}
                    {canManageRoster && (
                      <div className="grid-table-cell grid-table-cell-actions" role="cell">
                        <span className="grid-table-label">Actions</span>
                        <div className="table-actions-group">
                          {/* Edit — placeholder */}
                          <button
                            type="button"
                            className="btn-icon-action"
                            disabled={!canEdit}
                            onClick={() => handleEditMember(member)}
                            title={canEdit ? 'Edit member' : 'Edit unavailable'}
                            style={{ opacity: canEdit ? 1 : 0.35, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-destructive"
                            disabled={!canDelete}
                            onClick={async () => {
                              if (!canDelete) return;
                              if (!await confirm({ title: 'Remove Member', message: `Remove ${getMemberName(member)} from the roster?`, isDestructive: true })) return;
                              try {
                                const { error } = await supabase.from('roster').delete().eq('id', member.id);
                                if (error) throw error;
                                setSelectedMembers(prev => prev.filter(id => id !== member.id));
                                fetchRoster();
                                toast('Member removed', 'success');
                              } catch (err) {
                                console.error(err);
                                toast('Something went wrong. Please try again.', 'error');
                              }
                            }}
                            title={!canManageRoster ? 'Delete unavailable: insufficient permissions' : isOwnRow ? 'Cannot remove your own account' : 'Remove member'}
                            style={{ opacity: canDelete ? 1 : 0.35, cursor: canDelete ? 'pointer' : 'not-allowed' }}
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

      {/* ── Floating Bulk Action Pill ───────────────────────────────────── */}
      {selectedMembers.length > 0 && (
        <div className="bulk-action-pill">
          <div className="bulk-action-pill-info">
            <span className="bulk-action-pill-count">{selectedMembers.length}</span>
            <span className="bulk-action-pill-label">Selected</span>
            <button type="button" className="btn-icon-action btn-icon-clear" onClick={() => setSelectedMembers([])} title="Clear selection">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="bulk-action-pill-divider" />

          <div className="bulk-action-pill-actions">
            {/* Copy */}
            <button type="button" className="btn-icon-action" onClick={handleBulkCopy} title="Copy selected members as TSV" style={{ color: 'var(--color-primary)', borderColor: 'var(--border-color)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="bulk-action-btn-text">Copy</span>
            </button>

            {/* Remove */}
            <button type="button" className="btn-icon-action btn-icon-destructive" onClick={handleBulkRemove} title="Remove selected members">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="bulk-action-btn-text">Remove</span>
            </button>

            <div className="bulk-action-pill-divider" />

            {/* Help / Action Guide */}
            <button type="button" className="btn-icon-action btn-icon-help" onClick={() => setShowActionGuide(p => !p)} title="Action Guide">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>

            {showActionGuide && (
              <div className="action-guide-popover">
                <div className="action-guide-header">
                  <span>ACTION GUIDE</span>
                  <button type="button" className="action-guide-close" onClick={() => setShowActionGuide(false)} title="Close guide">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="action-guide-body">
                  <div className="action-guide-item">
                    <span className="action-guide-icon" style={{ color: 'var(--color-primary)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </span>
                    <span>Copy selected members as TSV</span>
                  </div>
                  <div className="action-guide-item">
                    <span className="action-guide-icon btn-icon-destructive">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </span>
                    <span>Remove selected members</span>
                  </div>
                </div>
                <div className="action-guide-arrow" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Member Modal (Members tab) ─────────────────────────────── */}
      <Modal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        title="Add Member"
      >
        <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="First Name (or Nickname)"
              value={newFirstName}
              onChange={e => setNewFirstName(e.target.value)}
              required
              maxLength={100}
              style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
            />
            <input
              type="text"
              placeholder="Last Initial"
              maxLength={1}
              value={newLastInitial}
              onChange={e => setNewLastInitial(e.target.value)}
              required
              style={{ width: '90px', padding: '0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
          <input
            type="text"
            placeholder="Member ID (Optional)"
            value={newMemberId}
            onChange={e => setNewMemberId(e.target.value)}
            style={{ padding: '0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddMemberModalOpen(false)}>Cancel</button>
            <button type="submit" disabled={!troopId || loading} className="btn btn-primary">ADD MEMBER</button>
          </div>
        </form>
      </Modal>

      {/* ── Single Badge Scanner Modal ────────────────────────────────────── */}
      <SingleBadgeScannerModal
        isOpen={!!scanningMember}
        onClose={() => setScanningMember(null)}
        onScan={handleScanSingleBadge}
        memberName={scanningMember?.name}
      />
    </div>
  );
}
