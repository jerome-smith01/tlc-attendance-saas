import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { parseTlcRosterCsv } from '../utils/csvParser';

export function RosterList({ troopId, currentUserRole, currentUserId, isGlobalAdmin }) {
  const canManageRoster = isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin';
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Manual add form state
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastInitial, setNewLastInitial] = useState('');
  const [newMemberId, setNewMemberId] = useState('');

  // Bulk selection state
  const [selectedMembers, setSelectedMembers] = useState([]);

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
      setError(null);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!newFirstName || !newLastInitial) return;

    try {
      setError(null);
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
    } catch (err) {
      console.error('Error adding member:', err);
      setError(err.message);
    }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setError(null);
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
      alert(`Successfully processed ${parsedMembers.length} members from CSV.`);
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError(err.message);
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
    if (!window.confirm(`Are you sure you want to remove ${selectedMembers.length} member(s)?`)) return;

    try {
      setError(null);
      const { error } = await supabase
        .from('roster')
        .delete()
        .in('id', selectedMembers);

      if (error) throw error;
      setSelectedMembers([]);
      fetchRoster();
    } catch (err) {
      console.error('Error deleting members:', err);
      setError(err.message);
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
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy', err);
      alert('Failed to copy to clipboard');
    }
  }

  if (loading) return <div>Loading roster...</div>;

  return (
    <div className="roster-list" style={{ marginTop: '2rem', border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
      <h2>Troop Roster</h2>
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'inherit' }}>
        <h3>Import from TLC CSV</h3>
        <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Your CSV file is processed safely on your device. We only extract Name and Member ID. All other PII (like addresses) is ignored.
        </p>
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleCsvUpload} 
          disabled={!troopId || loading}
        />
      </div>

      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'inherit' }}>
        <h3>Add Member Manually</h3>
        <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="First Name (or Nickname)" 
            value={newFirstName} 
            onChange={e => setNewFirstName(e.target.value)}
            required
            style={{ padding: '0.5rem' }}
          />
          <input 
            type="text" 
            placeholder="Last Initial" 
            maxLength={1}
            value={newLastInitial} 
            onChange={e => setNewLastInitial(e.target.value)}
            required
            style={{ padding: '0.5rem', width: '80px' }}
          />
          <input 
            type="text" 
            placeholder="Member ID (Optional)" 
            value={newMemberId} 
            onChange={e => setNewMemberId(e.target.value)}
            style={{ padding: '0.5rem' }}
          />
          <button type="submit" disabled={!troopId || loading} style={{ padding: '0.5rem 1rem' }}>Add</button>
        </form>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            {canManageRoster && (
              <th style={{ padding: '0.5rem', width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={
                    selectedMembers.length === roster.filter(m => m.role !== 'global_admin' && m.user_id !== currentUserId).length 
                    && roster.filter(m => m.role !== 'global_admin' && m.user_id !== currentUserId).length > 0
                  }
                  onChange={handleSelectAll}
                />
              </th>
            )}
            <th style={{ padding: '0.5rem' }}>Name</th>
            <th style={{ padding: '0.5rem' }}>Role</th>
            <th style={{ padding: '0.5rem' }}>Email</th>
            <th style={{ padding: '0.5rem' }}>Member ID</th>
            <th style={{ padding: '0.5rem' }}>Badge Linked?</th>
          </tr>
        </thead>
        <tbody>
          {roster.length === 0 ? (
            <tr>
              <td colSpan={canManageRoster ? "6" : "5"} style={{ padding: '1rem', textAlign: 'center' }}>No members found.</td>
            </tr>
          ) : (
            roster
              .filter(member => member.role !== 'global_admin')
              .map(member => (
                <tr key={member.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {canManageRoster && (
                    <td style={{ padding: '0.5rem' }}>
                      {member.user_id !== currentUserId && (
                        <input 
                          type="checkbox" 
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => handleToggleSelect(member.id)}
                        />
                      )}
                    </td>
                  )}
                  <td style={{ padding: '0.5rem' }}>{member.first_name} {member.last_initial}.</td>
                  <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>
                    {member.role ? member.role.replace('_', ' ') : 'Trailman'}
                  </td>
                  <td style={{ padding: '0.5rem', color: '#888', fontSize: '0.9em' }}>{member.email || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{member.member_id || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{member.tlc_id ? '✅ Yes' : '❌ No'}</td>
                </tr>
              ))
          )}
        </tbody>
      </table>

      {/* Sticky Bulk Actions Modal */}
      {selectedMembers.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#333',
          color: '#fff',
          padding: '1rem 2rem',
          borderRadius: '50px',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 1000
        }}>
          <span style={{ fontWeight: 'bold' }}>{selectedMembers.length} selected</span>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleBulkCopy}
              style={{ padding: '0.5rem 1.5rem', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Copy
            </button>
            <button 
              onClick={handleBulkRemove}
              style={{ padding: '0.5rem 1.5rem', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
