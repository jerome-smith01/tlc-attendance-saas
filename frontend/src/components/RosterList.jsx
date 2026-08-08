import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { parseTlcRosterCsv } from '../utils/csvParser';
import { DataTable } from './common/DataTable';
import { useToast } from './common/ToastContext';
import { useConfirm } from './common/ConfirmContext';

export function RosterList({ troopId, currentUserRole, currentUserId, isGlobalAdmin, activeTab }) {
  const canManageRoster = isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin';
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const toast = useToast();
  const confirm = useConfirm();
  
  // Manual add form state
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastInitial, setNewLastInitial] = useState('');
  const [newMemberId, setNewMemberId] = useState('');

  // Bulk selection state
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showActionGuide, setShowActionGuide] = useState(false);

  useEffect(() => {
    if (troopId) {
      fetchRoster();
    } else {
      setRoster([]);
      setSelectedMembers([]);
      setLoading(false);
    }
  }, [troopId]);

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
      // Remove any selected members that no longer exist
      setSelectedMembers(prev => prev.filter(id => (data || []).some(m => m.id === id)));
    } catch (err) {
      console.error('Error fetching roster:', err);
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!newFirstName || !newLastInitial) return;

    try {
      const { error } = await supabase.from('roster').insert([{
        troop_id: troopId,
        first_name: newFirstName,
        last_initial: newLastInitial.toUpperCase(),
        member_id: newMemberId || null
      }]);

      if (error) throw error;
      
      // Reset form and refresh list
      setNewFirstName('');
      setNewLastInitial('');
      setNewMemberId('');
      fetchRoster();
      toast('Member added successfully', 'success');
    } catch (err) {
      console.error('Error adding member:', err);
      toast(err.message, 'error');
    }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      
      const parsedMembers = await parseTlcRosterCsv(file);
      
      if (parsedMembers.length === 0) {
        throw new Error('No valid members found in CSV. Make sure it contains First Name, Last Name, and Member Number.');
      }

      // Add troop_id to each member
      const membersToInsert = parsedMembers.map(m => ({
        ...m,
        troop_id: troopId
      }));

      // In a real app, you might want to perform an upsert (ON CONFLICT) here
      // But for MVP-1, we'll assume a clean insert or rely on unique constraints to fail
      const { error } = await supabase
        .from('roster')
        .upsert(membersToInsert, { onConflict: 'troop_id, member_id', ignoreDuplicates: true });

      if (error) throw error;
      
      fetchRoster();
      toast(`Successfully processed ${parsedMembers.length} members from CSV.`, 'success');
    } catch (err) {
      console.error('Error uploading CSV:', err);
      toast(err.message, 'error');
    } finally {
      setLoading(false);
      // Reset the input so the same file can be uploaded again if needed
      e.target.value = null;
    }
  }

  function handleToggleSelect(memberId) {
    setSelectedMembers(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  }

  function handleSelectAll(e) {
    if (e.target.checked) {
      const allIds = roster
        .filter(m => m.role !== 'global_admin' && m.user_id !== currentUserId)
        .map(m => m.id);
      setSelectedMembers(allIds);
    } else {
      setSelectedMembers([]);
    }
  }

  async function handleBulkRemove() {
    if (!await confirm({ title: 'Remove Members', message: `Are you sure you want to remove ${selectedMembers.length} member(s)?`, isDestructive: true })) return;

    try {
      const { error } = await supabase
        .from('roster')
        .delete()
        .in('id', selectedMembers);

      if (error) throw error;
      setSelectedMembers([]);
      fetchRoster();
      toast('Members removed successfully', 'success');
    } catch (err) {
      console.error('Error deleting members:', err);
      toast(err.message, 'error');
    }
  }

  async function handleBulkCopy() {
    const selectedData = roster.filter(m => selectedMembers.includes(m.id));
    const header = "Name\tRole\tEmail\tMember ID\tBadge Linked?\n";
    const tsv = selectedData.map(m => 
      `${m.first_name} ${m.last_initial}.\t${m.role ? m.role.replace('_', ' ') : 'trailman'}\t${m.email || ''}\t${m.member_id || ''}\t${m.tlc_id ? 'Yes' : 'No'}`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(header + tsv);
      toast('Copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy', err);
      toast('Failed to copy to clipboard', 'error');
    }
  }

  const displayRoster = roster.filter(member => {
    if (member.role === 'global_admin') return false;
    if (activeTab === 'leaders') {
      return member.role !== null && member.role !== 'trailman';
    } else {
      return member.role === null || member.role === 'trailman';
    }
  });

  const rosterColumns = [];

  if (canManageRoster) {
    rosterColumns.push({
      label: (
        <input 
          type="checkbox" 
          checked={
            selectedMembers.length === displayRoster.filter(m => m.user_id !== currentUserId).length 
            && displayRoster.filter(m => m.user_id !== currentUserId).length > 0
          }
          onChange={handleSelectAll}
        />
      ),
      key: 'select',
      render: (val, member) => (
        member.user_id !== currentUserId ? (
          <input 
            type="checkbox" 
            checked={selectedMembers.includes(member.id)}
            onChange={() => handleToggleSelect(member.id)}
          />
        ) : null
      )
    });
  }

  rosterColumns.push({ label: 'Name', key: 'name', render: (val, member) => `${member.first_name} ${member.last_initial}.` });
  
  if (activeTab === 'leaders') {
    rosterColumns.push(
      { label: 'Role', key: 'role', render: (val, member) => <span style={{ textTransform: 'capitalize' }}>{member.role ? member.role.replace('_', ' ') : 'Trailman'}</span> },
      { label: 'Email', key: 'email', render: (val, member) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>{member.email || '-'}</span> }
    );
  }
  
  rosterColumns.push(
    { label: 'Member ID', key: 'member_id', render: (val, member) => member.member_id || '-' },
    { label: 'Badge Linked?', key: 'tlc_id', render: (val, member) => member.tlc_id ? '✅ Yes' : '❌ No' }
  );

  if (loading) return <div style={{ padding: '2rem' }}>Loading roster...</div>;

  return (
    <div className="roster-list" style={{ marginTop: '2rem' }}>
      <h2 style={{ marginBottom: '1rem', color: 'var(--foreground)' }}>Troop Roster</h2>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Import from TLC CSV</h3>
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Your CSV file is processed safely on your device. We only extract Name and Member ID. All other PII (like addresses) is ignored.
          </p>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleCsvUpload} 
            disabled={!troopId || loading}
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              background: 'var(--bg-secondary)', 
              color: 'var(--foreground)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-sm)' 
            }}
          />
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Add Member Manually</h3>
          <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="First Name (or Nickname)" 
                value={newFirstName} 
                onChange={e => setNewFirstName(e.target.value)}
                required
                style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
              />
              <input 
                type="text" 
                placeholder="Last Initial" 
                maxLength={1}
                value={newLastInitial} 
                onChange={e => setNewLastInitial(e.target.value)}
                required
                style={{ width: '80px', padding: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Member ID (Optional)" 
                value={newMemberId} 
                onChange={e => setNewMemberId(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
              />
              <button type="submit" disabled={!troopId || loading} className="btn btn-primary">Add</button>
            </div>
          </form>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <DataTable 
          data={displayRoster}
          columns={rosterColumns}
          keyField="id"
          storageKey={`roster_${activeTab || 'all'}`}
        />
      </div>

      {/* Floating Bulk Actions Pill */}
      {selectedMembers.length > 0 && (
        <div className="bulk-action-pill">
          {/* Left Side: Count, Label & Clear */}
          <div className="bulk-action-pill-info">
            <span className="bulk-action-pill-count">{selectedMembers.length}</span>
            <span className="bulk-action-pill-label">Selected</span>
            <button
              type="button"
              className="btn-icon-action btn-icon-clear"
              onClick={() => setSelectedMembers([])}
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

          {/* Right Side: Action Buttons */}
          <div className="bulk-action-pill-actions">
            <button 
              type="button"
              onClick={handleBulkCopy}
              className="btn-icon-action"
              style={{ color: 'var(--color-primary)', borderColor: 'var(--border-color)' }}
              title="Copy emails of selected members"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="bulk-action-btn-text">Copy Emails</span>
            </button>
            <button 
              type="button"
              onClick={handleBulkRemove}
              className="btn-icon-action btn-icon-destructive"
              title="Remove selected members"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="bulk-action-btn-text">Remove</span>
            </button>

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
                    <span className="action-guide-icon" style={{ color: 'var(--color-primary)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </span>
                    <span>Copy Emails</span>
                  </div>
                  <div className="action-guide-item">
                    <span className="action-guide-icon btn-icon-destructive">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </span>
                    <span>Remove Member</span>
                  </div>
                </div>
                <div className="action-guide-arrow" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
