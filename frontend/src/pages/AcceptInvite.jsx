import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { useToast } from '../components/common/ToastContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { PasswordStrengthMeter, passwordMeetsMinimum } from '../components/PasswordStrengthMeter';
import './Login.css';

export function AcceptInvite() {
  const { session, user, signOut, loading: authLoading } = useAuth();
  const { refreshTroops, setSelectedTroopId, selectedTroop } = useTroop();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');

  // Invite state
  const [validating, setValidating] = useState(true);
  const [inviteDetails, setInviteDetails] = useState(null); // { email, accountExists, troopName }
  const [validationError, setValidationError] = useState('');

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [mismatchData, setMismatchData] = useState(null); // { loggedInEmail, invitedEmail }
  const [success, setSuccess] = useState(false);

  // Prevents the auto-accept useEffect from double-firing after
  // handleCreateAccountAndAccept signs the user in and changes session.
  const acceptHandled = useRef(false);

  // 0. Check for pending invite token from OAuth
  useEffect(() => {
    const pendingToken = sessionStorage.getItem('pending_invite_token');
    if (pendingToken && session && !authLoading) {
      sessionStorage.removeItem('pending_invite_token');
      // Set token to search params effectively, but we already have 	oken from search params
      // However if we redirected back from OAuth without the token in the URL, we need to navigate to it
      if (!token) {
        navigate(`/accept-invite?token=${pendingToken}`, { replace: true });
      }
    }
  }, [session, authLoading, navigate, token]);

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
    // Guard: if another handler already initiated acceptance (e.g. handleCreateAccountAndAccept
    // signed the user in itself), don't fire a second accept call with the same token.
    if (acceptHandled.current) return;

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
    if (acceptHandled.current) return;
    acceptHandled.current = true;
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
      const targetPath = (selectedTroop?.currentUserRole === 'badge_scanner') ? '/events' : '/dashboard';
      setTimeout(() => navigate(targetPath, { replace: true }), 1500);
    } catch (err) {
      console.error('Accept invite error:', err);

      // If the user's account was deleted in Supabase but their local session is still active,
      // the edge function will return 401 Unauthorized. Clear the stale session and stay on the page.
      if (err.message && err.message.toLowerCase().includes('unauthorized')) {
        await signOut();
        acceptHandled.current = false;
        setSubmitting(false);
        return;
      }

      // Navigate to the dedicated error page so the auth redirect can't swallow the error
      navigate('/invite-error', {
        replace: true,
        state: { errorMessage: err.message || 'An error occurred while accepting the invite.' }
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setSubmitting(true);
      setFormError('');
      sessionStorage.setItem('pending_invite_token', token);
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (authError) throw authError;
    } catch (err) {
      console.error('[TLC Accept] Google auth error:', err.message);
      setFormError('Failed to sign in with Google. Please try again.');
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

    if (!firstName.trim()) {
      setFormError('Please enter your First Name.');
      setSubmitting(false);
      return;
    }

    if (!lastInitial.trim()) {
      setFormError('Please enter your Last Initial.');
      setSubmitting(false);
      return;
    }

    if (!passwordMeetsMinimum(password)) {
      setFormError('Password does not meet minimum security requirements.');
      setSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      setSubmitting(false);
      return;
    }

    try {
      // 1. Call edge function to create user & link to troop with roster entry
      const { data, error: fnError } = await supabase.functions.invoke('accept-invite-new-user', {
        body: {
          token,
          password,
          firstName: firstName.trim(),
          lastInitial: lastInitial.trim().charAt(0).toUpperCase()
        }
      });

      if (fnError) {
        let errMsg = fnError.message;
        try {
          const body = await fnError.context?.json?.();
          if (body?.error) errMsg = body.error;
        } catch (_) { }
        // Navigate to error page BEFORE any signInWithPassword call — otherwise the
        // auth state change silently redirects the user away without showing the error.
        navigate('/invite-error', {
          replace: true,
          state: { errorMessage: errMsg || 'Failed to create account.' }
        });
        return;
      }

      // 2. Sign in client-side to establish session (only reached on success).
      // Set the flag BEFORE signInWithPassword — the session change it triggers
      // re-runs the auto-accept useEffect, which must not call accept-invite again.
      acceptHandled.current = true;
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
      const targetPath = (selectedTroop?.currentUserRole === 'badge_scanner') ? '/events' : '/dashboard';
      setTimeout(() => navigate(targetPath, { replace: true }), 1500);
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
            <p style={{ color: 'var(--text-secondary)' }}>Redirecting you now...</p>
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
              Please sign in with Google or enter your password for <strong>{inviteDetails.email}</strong> to accept.
            </p>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
              <hr style={{ flex: 1, borderColor: 'var(--border-color)', margin: 0 }} />
              <span style={{ padding: '0 0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>or</span>
              <hr style={{ flex: 1, borderColor: 'var(--border-color)', margin: 0 }} />
            </div>

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
          /* State 5: New user -> Create account form */
          <div>
            <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '0.5rem' }}>
              Welcome! You've been invited to join <strong>{inviteDetails?.troopName}</strong>.
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Please enter your details and set a password to create your account.
            </p>

            <form onSubmit={handleCreateAccountAndAccept} noValidate style={{ textAlign: 'left' }}>
              {/* Email (Static Text Display) */}
              <div className="login-field" style={{ marginBottom: '1.25rem' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                  Email Address
                </span>
                <div
                  style={{
                    color: 'var(--color-primary, #3b82f6)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    wordBreak: 'break-all',
                    paddingLeft: '1rem',
                    paddingTop: '0.15rem',
                    paddingBottom: '0.15rem'
                  }}
                >
                  {inviteDetails?.email || ''}
                </div>
              </div>

              {/* First Name & Last Initial (2-column grid) */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div className="login-field">
                  <label htmlFor="first-name" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                    First Name <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <input
                    id="first-name"
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={e => { setFirstName(e.target.value); setFormError(''); }}
                    required
                    disabled={submitting}
                    autoFocus
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="last-initial" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                    Last Initial <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <input
                    id="last-initial"
                    type="text"
                    maxLength={1}
                    placeholder="L"
                    value={lastInitial}
                    onChange={e => { setLastInitial(e.target.value.toUpperCase()); setFormError(''); }}
                    required
                    disabled={submitting}
                    style={{ textAlign: 'left', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="login-field">
                <label htmlFor="create-password" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                  Password <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="create-password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setFormError(''); }}
                  required
                  disabled={submitting}
                />
                <PasswordStrengthMeter password={password} />
              </div>

              {/* Confirm Password */}
              <div className="login-field" style={{ marginTop: '0.75rem' }}>
                <label htmlFor="confirm-password" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                  Confirm Password <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setFormError(''); }}
                  required
                  disabled={submitting}
                />
                {confirmPassword.length > 0 && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: confirmPassword === password ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)',
                      fontWeight: 500,
                      transition: 'color 0.2s ease'
                    }}
                  >
                    <span style={{ fontWeight: 'bold', width: '14px', textAlign: 'center' }}>
                      {confirmPassword === password ? '✓' : '✗'}
                    </span>
                    <span>
                      {confirmPassword === password ? 'Passwords match' : 'Passwords do not match'}
                    </span>
                  </div>
                )}
              </div>

              {formError && <div className="login-error" role="alert" style={{ marginTop: '0.75rem' }}>{formError}</div>}

              <button
                type="submit"
                className="btn btn-primary login-submit"
                style={{ marginTop: '1rem' }}
                disabled={
                  submitting ||
                  !firstName.trim() ||
                  !lastInitial.trim() ||
                  !passwordMeetsMinimum(password) ||
                  password !== confirmPassword
                }
              >
                {submitting ? <><span className="spinner" /> Creating Account...</> : 'Create Account & Join Troop'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
