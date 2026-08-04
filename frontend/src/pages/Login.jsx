import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import './Login.css';

export function Login() {
  const { session } = useAuth();
  const navigate     = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // If already logged in, bounce to dashboard immediately
  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  // Clear error as soon as the user starts correcting their input
  const handleEmailChange    = (e) => { setError(''); setEmail(e.target.value); };
  const handlePasswordChange = (e) => { setError(''); setPassword(e.target.value); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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

  return (
    <div className="login-page">
      {/* Theme toggle — top right corner */}
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="login-card">
        {/* Placeholder logo — bright green square (no trademark) */}
        <div className="login-logo" aria-hidden="true" />

        <h1 className="app-title login-title">TLC Attendance</h1>
        <p className="login-subtitle">Sign in to your troop account</p>

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

          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={loading || !email || !password}
          >
            {loading
              ? <><span className="spinner" /> Signing in…</>
              : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
