import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Login.css'; // Reusing Login.css for consistent card styling

export function CompleteProfile() {
  const { session, user } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingInfo, setFetchingInfo] = useState(true);

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('roster')
          .select('first_name, last_initial')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (data) {
          setFirstName(data.first_name || '');
          setLastInitial(data.last_initial || '');
        }
      } catch (err) {
        console.error("Error loading profile", err);
      } finally {
        setFetchingInfo(false);
      }
    }
    loadProfile();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!firstName || !lastInitial) {
      setError('First name and last initial are required.');
      return;
    }

    setLoading(true);

    try {
      // 1. Update password if one was provided
      if (password) {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
      }

      // 2. Fetch the user's troop affiliations
      const { data: troopUsers, error: tuError } = await supabase
        .from('troop_users')
        .select('troop_id, role, onboarding_completed')
        .eq('user_id', user.id);

      if (tuError) throw tuError;

      if (!troopUsers || troopUsers.length === 0) {
        throw new Error('You do not belong to any troops. Please ask an admin for an invite.');
      }

      // 3. Update or create a roster entry for each troop the user belongs to
      for (const tu of troopUsers) {
        const { data: existingRoster } = await supabase
          .from('roster')
          .select('id')
          .eq('troop_id', tu.troop_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingRoster) {
          const { error: updateError } = await supabase
            .from('roster')
            .update({
              first_name: firstName,
              last_initial: lastInitial.charAt(0).toUpperCase()
            })
            .eq('id', existingRoster.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('roster')
            .insert({
              troop_id: tu.troop_id,
              user_id: user.id,
              first_name: firstName,
              last_initial: lastInitial.charAt(0).toUpperCase(),
              role: tu.role,
              email: user.email
            });
          if (insertError) throw insertError;
        }
      }

      const needsOnboarding = troopUsers.some(tu => !tu.onboarding_completed);

      // 4. Mark onboarding as completed for this user in all troops
      if (needsOnboarding) {
        const { error: updateError } = await supabase
          .from('troop_users')
          .update({ onboarding_completed: true })
          .eq('user_id', user.id);
        
        if (updateError) throw updateError;
        
        // Force reload to update TroopContext
        window.location.href = '#/dashboard';
        window.location.reload();
      } else {
        setSuccess('Profile updated successfully.');
        setPassword('');
        setConfirmPassword('');
      }

    } catch (err) {
      console.error('[Complete Profile] Error:', err);
      setError(err.message || 'An error occurred while updating your profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!session || fetchingInfo) return <div style={{ padding: '2rem' }}>Loading profile...</div>;

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '500px', width: '100%' }}>
        <h1 className="app-title login-title">My Profile</h1>
        <p className="login-subtitle">Update your personal details and password</p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="login-field" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="first-name" style={{ marginBottom: '0.5rem', display: 'block' }}>First Name</label>
              <input
                id="first-name"
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="login-field" style={{ width: '120px', marginBottom: 0 }}>
              <label htmlFor="last-initial" style={{ marginBottom: '0.5rem', display: 'block' }}>Last Initial</label>
              <input
                id="last-initial"
                type="text"
                placeholder="Last Initial"
                maxLength={1}
                value={lastInitial}
                onChange={e => setLastInitial(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <hr style={{ margin: '1.5rem 0', borderColor: 'var(--border-color)' }} />
          <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>

          <div className="login-field">
            <label htmlFor="new-password" style={{ marginBottom: '0.5rem', display: 'block' }}>New Password</label>
            <input
              id="new-password"
              type="password"
              placeholder="Leave blank to keep existing password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="confirm-password" style={{ marginBottom: '0.5rem', display: 'block' }}>Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '0.75rem', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={loading || !firstName || !lastInitial}
          >
            {loading ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
