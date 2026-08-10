import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/ToastContext';
import { useConfirm } from '../components/common/ConfirmContext';
import { SingleBadgeScannerModal } from '../components/SingleBadgeScannerModal';

export function Profile() {
  const navigate = useNavigate();
  const { session, user, loading: authLoading } = useAuth();
  const { selectedTroop, selectedTroopId } = useTroop();
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Scanner modal & highlight state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMemberIdHighlighted, setIsMemberIdHighlighted] = useState(false);

  const triggerMemberIdHighlight = () => {
    setIsMemberIdHighlighted(true);
    setTimeout(() => {
      setIsMemberIdHighlighted(false);
    }, 2500);
  };

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/login', { replace: true });
    }
  }, [session, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user, selectedTroopId]);

  async function fetchProfile() {
    try {
      setLoading(true);
      setEmail(user?.email || '');

      let query = supabase
        .from('roster')
        .select('*')
        .eq('user_id', user.id);

      if (selectedTroopId) {
        query = query.eq('troop_id', selectedTroopId);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile roster:', error);
      }

      if (data) {
        setMember(data);
        setFirstName(data.first_name || '');
        setLastInitial(data.last_initial || '');
        setMemberCode(data.member_id || '');
        setRole(data.role || '');
      } else {
        // Fallback to user metadata or email
        const metaName = user?.user_metadata?.full_name || '';
        const parts = metaName.split(' ');
        if (parts.length > 0) setFirstName(parts[0]);
        if (parts.length > 1) setLastInitial(parts[parts.length - 1][0]);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      addToast('Failed to load profile details.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastInitial.trim()) {
      addToast('First Name and Last Initial are required.', 'error');
      return;
    }

    if (password && password !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }

    try {
      setSaving(true);

      // 1. Update password if provided
      if (password) {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
      }

      // 2. Fetch all troop affiliations for this user
      const { data: troopUsers, error: tuError } = await supabase
        .from('troop_users')
        .select('troop_id, role, onboarding_completed')
        .eq('user_id', user.id);

      if (tuError) throw tuError;

      const formattedLastInitial = lastInitial.trim().charAt(0).toUpperCase();

      // 3. Update or create roster entry for each troop the user belongs to
      if (troopUsers && troopUsers.length > 0) {
        for (const tu of troopUsers) {
          const { data: existingRoster } = await supabase
            .from('roster')
            .select('id')
            .eq('troop_id', tu.troop_id)
            .eq('user_id', user.id)
            .maybeSingle();

          const updateObj = {
            first_name: firstName.trim(),
            last_initial: formattedLastInitial,
          };

          // Update member_id for the current troop
          if (tu.troop_id === selectedTroopId) {
            updateObj.member_id = memberCode.trim() || null;
          }

          if (existingRoster) {
            const { error: updateError } = await supabase
              .from('roster')
              .update(updateObj)
              .eq('id', existingRoster.id);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('roster')
              .insert({
                troop_id: tu.troop_id,
                user_id: user.id,
                first_name: firstName.trim(),
                last_initial: formattedLastInitial,
                member_id: tu.troop_id === selectedTroopId ? (memberCode.trim() || null) : null,
                role: tu.role,
                email: user.email
              });
            if (insertError) throw insertError;
          }
        }
      }

      // 4. Handle onboarding completion if needed
      const needsOnboarding = troopUsers?.some(tu => !tu.onboarding_completed);
      if (needsOnboarding) {
        const { error: updateError } = await supabase.rpc('complete_user_onboarding');
        if (updateError) throw updateError;

        addToast('Profile completed successfully!', 'success');
        window.location.hash = '#/events';
        window.location.reload();
        return;
      }

      addToast('Profile updated successfully!', 'success');
      setPassword('');
      setConfirmPassword('');
      setMember(prev => ({
        ...prev,
        first_name: firstName.trim(),
        last_initial: formattedLastInitial,
        member_id: memberCode.trim() || null
      }));

    } catch (err) {
      console.error('[Profile] Save Error:', err);
      addToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkBadge = async () => {
    if (!member?.id) return;

    const isConfirmed = await confirm({
      title: 'Unlink Badge',
      message: 'Are you sure you want to unlink your badge?',
      confirmText: 'Unlink',
      isDestructive: true,
    });

    if (!isConfirmed) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('roster')
        .update({ tlc_id: null })
        .eq('id', member.id);

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
    if (!member?.id) return;

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
        .eq('id', member.id);

      if (error && error.code === '23505' && scannedMemberId) {
        updateData = { tlc_id: tlcId };
        const retry = await supabase
          .from('roster')
          .update(updateData)
          .eq('id', member.id);
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

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--foreground)' }}>Loading profile...</div>;
  }

  const userDisplayName = `${firstName || ''} ${lastInitial || ''}.`.trim() || 'My Profile';

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          title="Back to Events"
          onClick={() => navigate('/events')}
          style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-move-left-icon lucide-move-left">
            <path d="M6 8L2 12L6 16"></path>
            <path d="M2 12H22"></path>
          </svg>
        </button>
        <div>
          <h1 style={{ color: 'var(--foreground)', margin: 0, fontSize: '1.5rem' }}>My Profile</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>{userDisplayName}</p>
        </div>
      </div>

      {/* Profile Details Form */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: 'var(--foreground)', fontSize: '1.1rem' }}>
          Personal Details
        </h3>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                First Name (or Nickname) *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                maxLength={100}
                style={{ width: '100%', maxWidth: '320px', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Last Initial *
              </label>
              <input
                type="text"
                value={lastInitial}
                onChange={e => setLastInitial(e.target.value)}
                required
                maxLength={1}
                style={{ width: '100px', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
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

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              readOnly
              disabled
              style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', opacity: 0.8, cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger, #ef4444)', marginTop: '0.25rem', display: 'block' }}>
              Note: Email editing feature is coming in a future update.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Role
            </label>
            <select
              value={role}
              disabled
              style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', opacity: 0.8, cursor: 'not-allowed' }}
            >
              <option value="billing_admin">Billing Admin</option>
              <option value="troop_admin">Troop Admin</option>
              <option value="badge_scanner">Badge Scanner</option>
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger, #ef4444)', marginTop: '0.25rem', display: 'block' }}>
              Note: Self-demotion and role transfer features are coming in a future update.
            </span>
          </div>

          <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />
          <h4 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1rem' }}>Change Password</h4>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--foreground)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

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

      {/* Danger Zone: Self / Troop Deletion Placeholder */}
      <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--color-danger, #ef4444)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--color-danger, #ef4444)', fontSize: '1.1rem' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          Self-deletion and troop deletion options.
        </p>

        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger, #ef4444)', marginBottom: '1rem', display: 'block' }}>
          Note: Account self-deletion (for non-billing admins) and troop deletion (for billing admins) are coming in a future update.
        </span>

        <button
          type="button"
          className="btn btn-secondary"
          disabled
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', opacity: 0.6, cursor: 'not-allowed' }}
        >
          Delete Account / Troop
        </button>
      </div>

      {/* Single Badge Scanner Modal */}
      {member && (
        <SingleBadgeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleScanBadge}
          memberName={userDisplayName}
        />
      )}
    </div>
  );
}
