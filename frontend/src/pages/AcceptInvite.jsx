import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { useToast } from '../components/common/ToastContext';
import { ThemeToggle } from '../components/ThemeToggle';
import './Login.css';

export function AcceptInvite() {
  const { session, user, signOut, loading: authLoading } = useAuth();
  const { refreshTroops, setSelectedTroopId } = useTroop();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');

  // Invite state
  const [validating, setValidating] = useState(true);
  const [inviteDetails, setInviteDetails] = useState(null); // { email, accountExists, troopName }
  const [validationError, setValidationError] = useState('');

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [mismatchData, setMismatchData] = useState(null); // { loggedInEmail, invitedEmail }
  const [success, setSuccess] = useState(false);

  // 1. Initial validation on mount
  useEffect(() => {
    if (!token) {
      setValidationError('Invalid invite link. Missing token.');
      setValidating(false);
      return;
    }

    validateToken(token);
  }, [token]);

  // 2. Auto-accept if logged in and email matches
  useEffect(() => {
    if (validating || authLoading || !inviteDetails || !session || success) return;

    const loggedInEmail = (user?.email || '').trim().toLowerCase();
    const invitedEmail = (inviteDetails.email || '').trim().toLowerCase();

    if (loggedInEmail === invitedEmail) {
      handleAcceptInvite();
    } else {
      setMismatchData({
        loggedInEmail: user?.email,
        invitedEmail: inviteDetails.email
      });
    }
  }, [validating, authLoading, inviteDetails, session]);

  const validateToken = async (inviteToken) => {
    setValidating(true);
    setValidationError('');

    try {
      const appUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${appUrl}/functions/v1/validate-invite?token=${inviteToken}`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate invite');
      }

      setInviteDetails(data);
    } catch (err) {
      console.error('Validate invite error:', err);
      setValidationError(err.message || 'Invalid or expired invite link.');
    } finally {
      setValidating(false);
    }
  };

  const handleAcceptInvite = async () => {
    setSubmitting(true);
    setFormError('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('accept-invite', {
        body: { token }
      });

      if (functionError) {
        let errMsg = functionError.message;
        try {
          const body = await functionError.context?.json?.();
          if (body?.emailMismatch) {
            setMismatchData({
              loggedInEmail: body.loggedInEmail,
              invitedEmail: body.invitedEmail
            });
            return;
          }
          if (body?.error) errMsg = body.error;
        } catch (_) { }
        throw new Error(errMsg || 'Failed to accept invite');
      }

      if (refreshTroops) {
        await refreshTroops();
      }
      if (data?.troop_id) {
        setSelectedTroopId(data.troop_id);
      }

      setSuccess(true);
      addToast('Invite accepted successfully!', 'success');
      setTimeout(() => navigate('/events', { replace: true }), 1500);
    } catch (err) {
      console.error('Accept invite error:', err);
      setFormError(err.message || 'An error occurred while accepting the invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignInAndAccept = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: inviteDetails.email,
        password
      });

      if (signInErr) {
        throw new Error('Invalid password. Please try again.');
      }

      // After sign-in, session updates and the auto-accept useEffect triggers
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  const handleCreateAccountAndAccept = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      setSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      setSubmitting(false);
      return;
    }

    try {
      // 1. Call edge function to create user & link to troop
      const { data, error: fnError } = await supabase.functions.invoke('accept-invite-new-user', {
        body: { token, password }
      });

      if (fnError) {
        let errMsg = fnError.message;
        try {
          const body = await fnError.context?.json?.();
          if (body?.error) errMsg = body.error;
        } catch (_) { }
        throw new Error(errMsg || 'Failed to create account.');
      }

      // 2. Sign in client-side to establish session
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: inviteDetails.email,
        password
      });

      if (signInErr) {
        throw new Error('Account created! Please log in on the main screen.');
      }

      if (refreshTroops) {
        await refreshTroops();
      }

      setSuccess(true);
      addToast('Account created and invite accepted!', 'success');
      setTimeout(() => navigate('/events', { replace: true }), 1500);
    } catch (err) {
      console.error('Create account error:', err);
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOutAndSwitch = async () => {
    await signOut();
    setMismatchData(null);
  };

  if (validating || authLoading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <span className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Validating invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="login-card" style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="Logo" className="login-logo" style={{ margin: '0 auto 1.5rem' }} />

        <h1 className="app-title login-title">Troop Invitation</h1>

        {validationError ? (
          <div style={{ padding: '1rem 0' }}>
            <div style={{ color: 'var(--color-error)', fontSize: '1rem', marginBottom: '1.5rem' }}>
              {validationError}
            </div>
            <button className="btn btn-secondary" onClick={() => navigate('/login')}>
              Go to Login
            </button>
          </div>
        ) : success ? (
          <div style={{ padding: '1rem 0' }}>
            <div style={{ color: 'var(--color-success)', fontSize: '1.2rem', marginBottom: '1rem', fontWeight: 600 }}>
              ✓ Invitation accepted!
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Redirecting you to your events...</p>
          </div>
        ) : mismatchData ? (
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '1rem' }}>
              You are currently signed in as:
            </p>
            <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontWeight: 600, marginBottom: '1rem' }}>
              {mismatchData.loggedInEmail}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', marginBottom: '1.5rem' }}>
              This invitation was sent to <strong>{mismatchData.invitedEmail}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={handleSignOutAndSwitch}>
                Sign Out & Switch Account
              </button>
            </div>
          </div>
        ) : session && submitting ? (
          <div style={{ padding: '2rem 0' }}>
            <span className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Joining {inviteDetails?.troopName}...</p>
          </div>
        ) : inviteDetails?.accountExists ? (
          /* State 4: Existing user -> Sign in form */
          <div>
            <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '1rem' }}>
              You've been invited to join <strong>{inviteDetails.troopName}</strong>!
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Please enter your password for <strong>{inviteDetails.email}</strong> to accept.
            </p>

            <form onSubmit={handleSignInAndAccept} noValidate style={{ textAlign: 'left' }}>
              <div className="login-field">
                <label htmlFor="invite-password" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <input
                  id="invite-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setFormError(''); }}
                  required
                  disabled={submitting}
                  autoFocus
                />
              </div>

              {formError && <div className="login-error" role="alert">{formError}</div>}

              <button type="submit" className="btn btn-primary login-submit" disabled={submitting || !password}>
                {submitting ? <><span className="spinner" /> Signing in...</> : 'Sign In & Accept Invite'}
              </button>
            </form>
          </div>
        ) : (
          /* State 5: New user -> Create password form */
          <div>
            <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '0.5rem' }}>
              Welcome! You've been invited to join <strong>{inviteDetails?.troopName}</strong>.
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Set a password for <strong>{inviteDetails?.email}</strong> to create your account.
            </p>

            <form onSubmit={handleCreateAccountAndAccept} noValidate style={{ textAlign: 'left' }}>
              <div className="login-field">
                <label htmlFor="create-password" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <input
                  id="create-password"
                  type="password"
                  placeholder="Create a password (min 6 chars)"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setFormError(''); }}
                  required
                  disabled={submitting}
                  autoFocus
                />
              </div>

              <div className="login-field">
                <label htmlFor="confirm-password" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setFormError(''); }}
                  required
                  disabled={submitting}
                />
              </div>

              {formError && <div className="login-error" role="alert">{formError}</div>}

              <button type="submit" className="btn btn-primary login-submit" disabled={submitting || !password || !confirmPassword}>
                {submitting ? <><span className="spinner" /> Creating Account...</> : 'Create Account & Join Troop'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
