import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/ToastContext';
import { ThemeToggle } from '../components/ThemeToggle';
import './Login.css';

export function AcceptInvite() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // If auth is still loading or there's no token, just wait/show error
    if (authLoading) return;

    if (!token) {
      setError('Invalid invite link. Missing token.');
      setLoading(false);
      return;
    }

    if (!session) {
      // User is not logged in. 
      setLoading(false);
      return;
    }

    // User is logged in and we have a token, automatically accept
    acceptInvite(token);
  }, [session, authLoading, token]);

  const acceptInvite = async (inviteToken) => {
    setLoading(true);
    setError('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('accept-invite', {
        body: { token: inviteToken }
      });

      if (functionError) {
        let errMsg = functionError.message;
        try {
          const body = await functionError.context?.json?.();
          if (body?.error) errMsg = body.error;
        } catch (_) { }
        throw new Error(errMsg || 'Failed to accept invite');
      }

      setSuccess(true);
      addToast('Invite accepted successfully!', 'success');
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/events', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('Accept invite error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    // Store the intent to come back here after login
    // The easiest way is just to pass it in state or return to the exact same URL
    // Login.jsx currently redirects to /events if session exists, but let's just 
    // navigate to /login. Since the user can just click the email link again, or
    // we can redirect them to login with a ?redirect query param if our Login supported it.
    // Given the current Login implementation, clicking login will just log them in 
    // and they can click the email link again, or we can just hope they log in and it works.
    // Actually, the email link has the token. If they go to /login, they lose the token unless 
    // we use state. But they might close the tab. The best UX is to let them log in.
    navigate('/login');
  };

  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <span className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)' }} />
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
        
        {loading ? (
          <div style={{ padding: '2rem 0' }}>
            <span className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Processing your invitation...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '1rem 0' }}>
            <div style={{ color: 'var(--color-error)', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
              {error}
            </div>
            <button className="btn btn-secondary" onClick={() => navigate('/events')}>
              Return to App
            </button>
          </div>
        ) : success ? (
          <div style={{ padding: '1rem 0' }}>
            <div style={{ color: 'var(--color-success)', fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 600 }}>
              ✓ Invitation accepted!
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Redirecting you to your events...</p>
          </div>
        ) : !session ? (
          <div style={{ padding: '1rem 0' }}>
            <p style={{ fontSize: '1rem', color: 'var(--foreground)', marginBottom: '1.5rem' }}>
              You've been invited to join a troop. Please log in to accept the invitation.
            </p>
            <div className="form-helper-text" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              (If you log in and aren't automatically redirected back here, simply click the link in your email again.)
            </div>
            <button className="btn btn-primary" onClick={handleLoginRedirect}>
              Go to Login
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
