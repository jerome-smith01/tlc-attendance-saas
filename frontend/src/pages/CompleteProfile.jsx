import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import './Login.css'; // Reusing Login.css for consistent card styling

export function CompleteProfile() {
  const { session, user } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If user is not logged in at all, redirect to login
    if (!session) {
      navigate('/login', { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

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

      // 2. Fetch the user's troop affiliations to create their roster entries
      const { data: troopUsers, error: tuError } = await supabase
        .from('troop_users')
        .select('troop_id, role')
        .eq('user_id', user.id);

      if (tuError) throw tuError;

      if (!troopUsers || troopUsers.length === 0) {
        throw new Error('You do not belong to any troops. Please ask an admin for an invite.');
      }

      // 3. Create a roster entry for each troop the user belongs to
      for (const tu of troopUsers) {
        const { error: rosterError } = await supabase
          .from('roster')
          .insert({
            troop_id: tu.troop_id,
            user_id: user.id,
            first_name: firstName,
            last_initial: lastInitial.charAt(0).toUpperCase(),
            role: tu.role,
            email: user.email
          });
        
        // Ignore unique constraint violations (if they already have a profile for this troop)
        if (rosterError && rosterError.code !== '23505') {
          throw rosterError;
        }
      }

      // 4. Mark onboarding as completed for this user in all troops
      const { error: updateError } = await supabase
        .from('troop_users')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id);
      
      if (updateError) throw updateError;

      // Redirect to dashboard upon success
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('[Complete Profile] Error:', err);
      setError(err.message || 'An error occurred while updating your profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null; // Avoid flashing the form while redirecting

  return (
    <div className="login-page">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="login-card" style={{ maxWidth: '500px' }}>
        <h1 className="app-title login-title">Complete Profile</h1>
        <p className="login-subtitle">Set up your account details to continue</p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="login-field" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="first-name" className="sr-only">First Name</label>
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
              <label htmlFor="last-initial" className="sr-only">Last Initial</label>
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

          <div className="login-field">
            <label htmlFor="new-password" className="sr-only">New Password</label>
            <input
              id="new-password"
              type="password"
              placeholder="New Password (optional if already set)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
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

          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={loading || !firstName || !lastInitial}
          >
            {loading ? <><span className="spinner" /> Saving…</> : 'Save & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
