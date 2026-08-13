import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ThemeToggle } from '../components/ThemeToggle';
import './Login.css';

export function InviteError() {
  const navigate = useNavigate();
  const location = useLocation();

  const errorMessage =
    location.state?.errorMessage ||
    'This invite link is no longer valid or has already been accepted.';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    setResetMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[InviteError] Sign in error:', error.message);
      setLoginError('Invalid email or password. Please try again.');
      setLoading(false);
    }
    // On success: AuthContext updates session → ProtectedRoute redirects to dashboard
  };

  const handleResetPassword = async () => {
    if (!email) {
      setLoginError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setLoginError('');
    setResetMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    });

    if (error) {
      console.error('[InviteError] Reset password error:', error.message);
      setLoginError('Failed to send reset email. Please try again.');
    } else {
      setResetMessage('Password reset email sent! Check your inbox.');
    }
    setLoading(false);
  };

  const handleContactSupport = () => {
    // Placeholder — wire up to support system when available
    alert('Support contact coming soon. Please reach out to your troop admin for now.');
  };

  return (
    <div className="login-page">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="login-card" style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="Logo" className="login-logo" style={{ margin: '0 auto 0.5rem' }} />

        {/* Error Icon */}
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--color-error, #ef4444) 12%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 0.25rem',
          flexShrink: 0
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-error, #ef4444)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="app-title login-title" style={{ fontSize: '1.5rem' }}>
          Invite Link Unavailable
        </h1>

        {/* Error detail */}
        <div style={{
          background: 'color-mix(in srgb, var(--color-error, #ef4444) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-error, #ef4444) 25%, transparent)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1rem',
          fontSize: '0.875rem',
          color: 'var(--foreground)',
          textAlign: 'left',
          width: '100%'
        }}>
          {errorMessage}
        </div>

        {/* Guidance */}
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Ask your troop admin to send you a new invitation. Each invite link can only be used once
          and expires after a set period.
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
          <button
            type="button"
            className="btn btn-compact btn-outline"
            style={{
              width: '100%',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--foreground)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.6rem 1rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'background var(--transition-fast)'
            }}
            onClick={() => setShowLogin(v => !v)}
          >
            {showLogin ? 'Hide Sign In' : 'Already have an account? Sign In'}
          </button>

          <button
            type="button"
            onClick={handleContactSupport}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0.15rem 0'
            }}
          >
            Contact Support
          </button>
        </div>

        {/* Collapsible Login Form */}
        {showLogin && (
          <form
            onSubmit={handleSignIn}
            noValidate
            style={{ width: '100%', textAlign: 'left', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.25rem' }}
          >
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', marginTop: 0 }}>
              Sign in to access your existing troop account.
            </p>

            <div className="login-field">
              <label htmlFor="invite-error-email" className="sr-only">Email address</label>
              <input
                id="invite-error-email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => { setEmail(e.target.value); setLoginError(''); setResetMessage(''); }}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="login-field">
              <label htmlFor="invite-error-password" className="sr-only">Password</label>
              <input
                id="invite-error-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError(''); }}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {loginError && (
              <div className="login-error" role="alert">{loginError}</div>
            )}
            {resetMessage && (
              <div style={{ color: 'var(--color-success)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                {resetMessage}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading || !email || !password}
            >
              {loading ? <><span className="spinner" /> Signing in…</> : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
