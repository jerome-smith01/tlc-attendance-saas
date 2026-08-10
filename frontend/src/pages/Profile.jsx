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

  // Personal Info Form State
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [savingPersonalInfo, setSavingPersonalInfo] = useState(false);

  // Account Details State (Read-only)
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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

  const handleSavePersonalInfo = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastInitial.trim()) {
      addToast('First Name and Last Initial are required.', 'error');
      return;
    }

    try {
      setSavingPersonalInfo(true);

      const { data: troopUsers, error: tuError } = await supabase
        .from('troop_users')
        .select('troop_id, role, onboarding_completed')
        .eq('user_id', user.id);

      if (tuError) throw tuError;

      const formattedLastInitial = lastInitial.trim().charAt(0).toUpperCase();

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

      const needsOnboarding = troopUsers?.some(tu => !tu.onboarding_completed);
      if (needsOnboarding) {
        const { error: updateError } = await supabase.rpc('complete_user_onboarding');
        if (updateError) throw updateError;

        addToast('Profile completed successfully!', 'success');
        window.location.hash = '#/events';
        window.location.reload();
        return;
      }

      addToast('Personal information updated successfully!', 'success');
      setMember(prev => ({
        ...prev,
        first_name: firstName.trim(),
        last_initial: formattedLastInitial,
        member_id: memberCode.trim() || null
      }));

    } catch (err) {
      console.error('[Profile] Personal Info Save Error:', err);
      addToast(err.message || 'Failed to update personal information.', 'error');
    } finally {
      setSavingPersonalInfo(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      addToast('Please enter your current password.', 'error');
      return;
    }

    if (!newPassword) {
      addToast('Please enter a new password.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      addToast('New password must be at least 6 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match.', 'error');
      return;
    }

    try {
      setSavingPassword(true);

      // Verify current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        addToast('Current password is incorrect.', 'error');
        setSavingPassword(false);
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      addToast('Password updated successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('[Profile] Password Update Error:', err);
      addToast(err.message || 'Failed to update password.', 'error');
    } finally {
      setSavingPassword(false);
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

  const formatRoleName = (r) => {
    if (!r) return 'Member';
    switch (r) {
      case 'billing_admin': return 'Billing Admin';
      case 'troop_admin': return 'Troop Admin';
      case 'badge_scanner': return 'Badge Scanner';
      case 'global_admin': return 'Global Admin';
      default:
        return r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  return (
    <div className="profile-page-wrapper">

      {/* Header */}
      <div className="profile-header">
        <button
          type="button"
          className="btn btn-secondary"
          title="Back to Events"
          onClick={() => navigate('/events')}
          style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8L2 12L6 16"></path>
            <path d="M2 12H22"></path>
          </svg>
        </button>
        <div>
          <h1 style={{ color: 'var(--foreground)', margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-display)' }}>My Profile</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>{userDisplayName}</p>
        </div>
      </div>

      {/* Card 1: Personal Information */}
      <div className="glass-card form-card">
        <div className="form-card-header">
          <div className="form-card-header-main">
            <h3 className="form-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Personal Information
            </h3>
            <p className="form-card-subtitle">Manage your name and troop member identification</p>
          </div>
        </div>

        <form onSubmit={handleSavePersonalInfo}>
          <div className="form-row-responsive">
            <div className="form-group form-group-flex-2">
              <label className="form-label">
                First Name (or Nickname) <span className="required-asterisk">*</span>
              </label>
              <input
                type="text"
                className="form-control-input"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                maxLength={100}
                placeholder="e.g. John"
              />
            </div>

            <div className="form-group form-group-flex-initial">
              <label className="form-label">
                Last Initial <span className="required-asterisk">*</span>
              </label>
              <input
                type="text"
                className="form-control-input"
                value={lastInitial}
                onChange={e => setLastInitial(e.target.value)}
                required
                maxLength={1}
                placeholder="D"
              />
            </div>

            <div className="form-group form-group-flex-2">
              <label className="form-label">
                Member ID <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>(Optional)</span>
              </label>
              <input
                type="text"
                className="form-control-input"
                value={memberCode}
                onChange={e => setMemberCode(e.target.value)}
                placeholder="e.g. 123456"
                style={{
                  background: isMemberIdHighlighted ? 'var(--bg-highlight, rgba(59, 130, 246, 0.15))' : undefined,
                  borderColor: isMemberIdHighlighted ? 'var(--color-primary, #3b82f6)' : undefined,
                  boxShadow: isMemberIdHighlighted ? '0 0 8px rgba(59, 130, 246, 0.4)' : undefined,
                  transition: 'all 0.3s ease'
                }}
              />
            </div>
          </div>

          <div className="form-card-footer">
            <button type="submit" className="btn btn-primary" disabled={savingPersonalInfo}>
              {savingPersonalInfo ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {/* Card 2: Account Details (Read-only) */}
      <div className="glass-card form-card">
        <div className="form-card-header">
          <div className="form-card-header-main">
            <h3 className="form-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
              </svg>
              Account Details
            </h3>
            <p className="form-card-subtitle">View your email address and assigned role within your troop</p>
          </div>
        </div>

        <div className="form-row-responsive">
          <div className="form-group form-group-flex-1">
            <label className="form-label">
              Email Address
            </label>
            <div className="form-control-readonly">
              <span>{email || 'No email associated'}</span>
              <span className="form-readonly-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Read-only
              </span>
            </div>
            <div className="form-helper-text">
              Email address is managed via your login credentials.
            </div>
          </div>

          <div className="form-group form-group-flex-1">
            <label className="form-label">
              Current Role
            </label>
            <div className="form-control-readonly">
              <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{formatRoleName(role)}</span>
              <span className="form-readonly-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                Assigned Role
              </span>
            </div>
            <div className="form-helper-text">
              Role permissions are managed by your Troop Administrator.
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Security / Update Password */}
      <div className="glass-card form-card">
        <div className="form-card-header">
          <div className="form-card-header-main">
            <h3 className="form-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Security
            </h3>
            <p className="form-card-subtitle">Update your account password</p>
          </div>
        </div>

        <form onSubmit={handleUpdatePassword}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div className="form-group" style={{ maxWidth: '400px' }}>
              <label className="form-label">
                Current Password <span className="required-asterisk">*</span>
              </label>
              <input
                type="password"
                className="form-control-input"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-row-responsive">
              <div className="form-group form-group-flex-1">
                <label className="form-label">
                  New Password <span className="required-asterisk">*</span>
                </label>
                <input
                  type="password"
                  className="form-control-input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group form-group-flex-1">
                <label className="form-label">
                  Confirm New Password <span className="required-asterisk">*</span>
                </label>
                <input
                  type="password"
                  className="form-control-input"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="password-requirements-box">
              <div style={{ fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                Password Requirements:
              </div>
              <ul>
                <li>Must be at least 6 characters in length</li>
                <li>New password and confirmation password must match</li>
              </ul>
            </div>
          </div>

          <div className="form-card-footer">
            <button type="submit" className="btn btn-primary" disabled={savingPassword}>
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Card 4: Badge Management */}
      <div className="glass-card form-card">
        <div className="form-card-header">
          <div className="form-card-header-main">
            <h3 className="form-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z"></path>
              </svg>
              Badge Management
            </h3>
            <p className="form-card-subtitle">Link or unlink your physical Trail Life badge</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
              Badge Link Status
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {member?.tlc_id ? (
                <span style={{ color: 'var(--color-success, #10b981)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
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
              >
                Scan New Badge
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card 5: Danger Zone */}
      <div className="glass-card form-card" style={{ border: '1px solid color-mix(in srgb, var(--color-danger, #ef4444) 30%, transparent)' }}>
        <div className="form-card-header" style={{ borderBottomColor: 'color-mix(in srgb, var(--color-danger, #ef4444) 20%, transparent)' }}>
          <div className="form-card-header-main">
            <h3 className="form-card-title" style={{ color: 'var(--color-danger, #ef4444)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Danger Zone
            </h3>
            <p className="form-card-subtitle">Account deletion and troop administration controls</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
              Account Deletion
            </div>
            <div className="form-helper-text">
              Self-deletion and troop deletion options are managed by billing administrators.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
          >
            Delete Account
          </button>
        </div>
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
