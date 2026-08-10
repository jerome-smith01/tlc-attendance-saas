import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/ToastContext';
import { useConfirm } from '../components/common/ConfirmContext';
import { SingleBadgeScannerModal } from '../components/SingleBadgeScannerModal';

export function EditMember() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { selectedTroop, selectedTroopId, isGlobalAdmin } = useTroop();
  const { user } = useAuth();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');

  // Scanner modal & highlight state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMemberIdHighlighted, setIsMemberIdHighlighted] = useState(false);

  const currentUserRole = selectedTroop?.currentUserRole;
  const canManageRoster = isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin';

  const triggerMemberIdHighlight = () => {
    setIsMemberIdHighlighted(true);
    setTimeout(() => {
      setIsMemberIdHighlighted(false);
    }, 2500);
  };

  useEffect(() => {
    if (!memberId) return;
    fetchMember();
  }, [memberId]);

  async function fetchMember() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('roster')
        .select('*')
        .eq('id', memberId)
        .single();

      if (error) throw error;

      if (data) {
        setMember(data);
        setFirstName(data.first_name || '');
        setLastInitial(data.last_initial || '');
        setMemberCode(data.member_id || '');
        setRole(data.role || '');
        setEmail(data.email || '');
      }
    } catch (err) {
      console.error('Error fetching member:', err);
      addToast('Failed to load member details.', 'error');
      navigate('/roster');
    } finally {
      setLoading(false);
    }
  }

  const isLeader = member && member.role !== null && member.role !== 'trailman';
  const isProtectedRole = member && (member.role === 'billing_admin' || member.role === 'global_admin');
  const isOwnAccount = member && member.user_id === user?.id;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastInitial.trim()) {
      addToast('First Name and Last Initial are required.', 'error');
      return;
    }

    try {
      setSaving(true);
      const updates = {
        first_name: firstName.trim(),
        last_initial: lastInitial.trim().toUpperCase(),
        member_id: memberCode.trim() || null,
      };

      if (isLeader && !isProtectedRole) {
        updates.role = role;
      }

      const { error } = await supabase
        .from('roster')
        .update(updates)
        .eq('id', memberId);

      if (error) throw error;

      // If member has a user_id and role was updated, update troop_users table as well
      if (isLeader && !isProtectedRole && member.user_id && member.troop_id) {
        const { error: tuError } = await supabase
          .from('troop_users')
          .update({ role: role })
          .eq('user_id', member.user_id)
          .eq('troop_id', member.troop_id);

        if (tuError) console.error('Error updating troop_users role:', tuError);
      }

      addToast('Member details updated successfully!', 'success');
      setMember(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('Error updating member:', err);
      addToast('Failed to update member details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkBadge = async () => {
    const isConfirmed = await confirm({
      title: 'Unlink Badge',
      message: `Are you sure you want to unlink the badge for ${firstName} ${lastInitial}.?`,
      confirmText: 'Unlink',
      isDestructive: true,
    });

    if (!isConfirmed) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('roster')
        .update({ tlc_id: null })
        .eq('id', memberId);

      if (error) throw error;

      setMember(prev => ({ ...prev, tlc_id: null }));
      addToast('Badge unlinked successfully.', 'success');
    } catch (err) {
      console.error('Error unlinking badge:', err);
      addToast('Failed to unlink badge.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleScanBadge = async (scanData) => {
    const { tlcId, memberId: scannedMemberId } = typeof scanData === 'string'
      ? { tlcId: scanData, memberId: null }
      : scanData;

    try {
      let updateData = { tlc_id: tlcId };
      if (scannedMemberId && !memberCode) {
        updateData.member_id = scannedMemberId;
      }

      let { error } = await supabase
        .from('roster')
        .update(updateData)
        .eq('id', memberId);

      if (error && error.code === '23505' && scannedMemberId) {
        updateData = { tlc_id: tlcId };
        const retry = await supabase
          .from('roster')
          .update(updateData)
          .eq('id', memberId);
        error = retry.error;
      }

      if (error) {
        if (error.code === '23505') {
          addToast('This badge is already linked to another member in your troop.', 'error');
          setIsScannerOpen(false);
          return;
        }
        throw error;
      }

      setMember(prev => ({ ...prev, ...updateData }));
      if (updateData.member_id) {
        setMemberCode(updateData.member_id);
      }
      triggerMemberIdHighlight();
      addToast('Badge linked successfully!', 'success');
    } catch (err) {
      console.error('Error linking badge:', err);
      addToast('Failed to link badge.', 'error');
    }
    setIsScannerOpen(false);
  };

  const handleDeleteMember = async () => {
    if (isOwnAccount) {
      addToast('You cannot remove your own account.', 'error');
      return;
    }

    const memberDisplayName = `${firstName} ${lastInitial}.`;
    const isConfirmed = await confirm({
      title: 'Remove Member',
      message: `Are you sure you want to remove ${memberDisplayName} from the roster? This action cannot be undone.`,
      confirmText: 'Delete',
      isDestructive: true,
    });

    if (!isConfirmed) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('roster')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      addToast('Member deleted successfully.', 'success');
      navigate('/roster');
    } catch (err) {
      console.error('Error deleting member:', err);
      addToast('Failed to delete member.', 'error');
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--foreground)' }}>Loading member details...</div>;
  }

  if (!canManageRoster) {
    return (
      <div style={{ padding: '2rem', color: 'var(--foreground)' }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to edit roster members.</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/roster')}>
          Back to Roster
        </button>
      </div>
    );
  }

  const memberDisplayName = `${member?.first_name || ''} ${member?.last_initial || ''}.`.trim();

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>

      {/* Header & Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          title="Back to Roster"
          onClick={() => navigate('/roster')}
          style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-move-left-icon lucide-move-left">
            <path d="M6 8L2 12L6 16"></path>
            <path d="M2 12H22"></path>
          </svg>
        </button>
        <div>
          <h1 style={{ color: 'var(--foreground)', margin: 0, fontSize: '1.5rem' }}>Edit Member</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>{memberDisplayName}</p>
        </div>
      </div>

      {/* Member Details Form */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: 'var(--foreground)', fontSize: '1.1rem' }}>
          Member Details
        </h3>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                First Name (or Nickname) *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                maxLength={100}
                style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ flex: '0 0 100px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Last Initial *
              </label>
              <input
                type="text"
                value={lastInitial}
                onChange={e => setLastInitial(e.target.value)}
                required
                maxLength={1}
                style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Member ID (Optional)
            </label>
            <input
              type="text"
              value={memberCode}
              onChange={e => setMemberCode(e.target.value)}
              placeholder="e.g. 123456"
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem',
                background: isMemberIdHighlighted ? 'var(--bg-highlight, rgba(59, 130, 246, 0.15))' : 'var(--bg-secondary)',
                color: 'var(--foreground)',
                border: isMemberIdHighlighted ? '2px solid var(--color-primary, #3b82f6)' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                boxSizing: 'border-box',
                transition: 'all 0.3s ease',
                boxShadow: isMemberIdHighlighted ? '0 0 8px rgba(59, 130, 246, 0.4)' : 'none'
              }}
            />
          </div>

          {/* Leader specific fields */}
          {isLeader && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', opacity: 0.8, cursor: 'not-allowed' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Email editing is currently read-only.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Role
                </label>
                {isProtectedRole ? (
                  <input
                    type="text"
                    value={role === 'billing_admin' ? 'Billing Admin' : 'Global Admin'}
                    readOnly
                    disabled
                    style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', opacity: 0.8, cursor: 'not-allowed' }}
                  />
                ) : (
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
                  >
                    <option value="troop_admin">Troop Admin</option>
                    <option value="badge_scanner">Badge Scanner</option>
                  </select>
                )}
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Badge Management Section */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: 'var(--foreground)', fontSize: '1.1rem' }}>
          Badge Management
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
              Badge Link Status
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {member?.tlc_id ? (
                <span style={{ color: 'var(--color-success, #10b981)', fontWeight: 500 }}>
                  Linked (TLC ID: {member.tlc_id})
                </span>
              ) : (
                <span>No badge currently linked</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {member?.tlc_id ? (
              <>
                <a
                  href={`https://www.traillifeconnect.com/profile/${member.tlc_id}/overview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View Profile
                </a>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleUnlinkBadge}
                  disabled={saving}
                  style={{ borderColor: 'var(--color-danger, #ef4444)', color: 'var(--color-danger, #ef4444)' }}
                >
                  Unlink Badge
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsScannerOpen(true)}
                disabled={saving}
              >
                Scan New Badge
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone: Delete Member */}
      <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--color-danger, #ef4444)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--color-danger, #ef4444)', fontSize: '1.1rem' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Removing this member will delete them from the roster. This action cannot be undone.
        </p>

        <button
          type="button"
          className="btn btn-secondary btn-icon-destructive"
          onClick={handleDeleteMember}
          disabled={saving || isOwnAccount}
          style={{ background: 'var(--color-danger, #ef4444)', color: '#fff', border: 'none' }}
        >
          {isOwnAccount ? 'Cannot Delete Own Account' : 'Delete Member'}
        </button>
      </div>

      {/* Single Badge Scanner Modal */}
      <SingleBadgeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanBadge}
        memberName={memberDisplayName}
      />
    </div>
  );
}
