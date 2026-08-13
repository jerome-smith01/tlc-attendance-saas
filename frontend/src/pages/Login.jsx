import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { ThemeToggle } from '../components/ThemeToggle';
import './Login.css';

export function Login() {
  const { session } = useAuth();
  const { selectedTroop, troops, loadingTroops } = useTroop();
  const navigate     = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);

  // If already logged in, bounce to appropriate home route immediately once troops settle
  useEffect(() => {
    if (session && !loadingTroops) {
      const userRole = selectedTroop?.currentUserRole || troops?.[0]?.currentUserRole;
      if (userRole === 'badge_scanner') {
        navigate('/events', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [session, loadingTroops, selectedTroop, troops, navigate]);

  // If we have a session, don't render the login form while waiting to redirect
  if (session) {
    return (
      <div className="login-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <span className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  // Clear error as soon as the user starts correcting their input
  const handleEmailChange    = (e) => { setError(''); setMessage(''); setEmail(e.target.value); };
  const handlePasswordChange = (e) => { setError(''); setMessage(''); setPassword(e.target.value); };


  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (authError) throw authError;
    } catch (err) {
      console.error('[TLC Login] Google auth error:', err.message);
      setError('Failed to sign in with Google. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      // Security: Do NOT echo the raw Supabase error message back to the user.
      // It can contain internal details. Show a generic message instead.
      // Log the real error to the console for developer debugging.
      console.error('[TLC Login] Auth error:', authError.message);
      setError('Invalid email or password. Please try again.');
      setLoading(false);
    }
    // On success: onAuthStateChange → AuthContext updates session → useEffect above redirects
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address to reset your password.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    });
    
    if (error) {
      console.error('[TLC Login] Reset password error:', error.message);
      setError('Failed to send reset email. Please try again.');
    } else {
      setMessage('Password reset email sent! Check your inbox.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Theme toggle — top right corner */}
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="login-card">
        {/* App Logo */}
        <img src="/logo.png" alt="Logo" className="login-logo" />

        <h1 className="app-title login-title">TLC Attendance</h1>
        <p className="login-subtitle">Sign in to your troop account</p>

        {/* Google OAuth - Temporarily hidden until Google Cloud Console app is published */}
        {/*
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)', margin: 0 }} />
          <span style={{ padding: '0 0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>or</span>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)', margin: 0 }} />
        </div>
        */}

        <form onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="login-email" className="sr-only">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={handleEmailChange}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="sr-only">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="login-message" role="status" style={{ color: 'var(--color-success)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading || !email || !password}
          >
            {loading
              ? <><span className="spinner" /> Signing in…</>
              : 'Sign In'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={handleResetPassword}
              disabled={loading}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Forgot Password?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
