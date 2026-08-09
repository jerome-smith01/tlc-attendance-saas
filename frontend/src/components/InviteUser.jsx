import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function InviteUser({ troopId }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('badge_scanner');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function handleInvite(e) {
    e.preventDefault();
    if (!email || !troopId) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      // Call our Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role, troop_id: troopId }
      });

      if (error) {
        // FunctionsHttpError wraps the real response — read the JSON body for the actual message
        let errMsg = error.message;
        try {
          const body = await error.context?.json?.();
          if (body?.error) errMsg = body.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      setMessage(`Successfully sent invite to ${email}`);
      setEmail('');
    } catch (err) {
      console.error('Invite error:', err);
      // Translate obscure Edge Function errors into a friendly message
      if (err.message && err.message.includes('non-2xx status code')) {
        setError('This email is already invited or registered with TLC Attendance.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Invite Troop Leaders</h3>
      <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--muted-foreground)' }}>
        Send an email invitation to add a new leader to this troop.
      </p>
      {error && <div style={{ color: 'var(--color-error)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
      {message && <div style={{ color: 'var(--color-success)', marginBottom: '1rem', fontSize: '0.875rem' }}>{message}</div>}

      <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input 
          type="email" 
          placeholder="Email address" 
          value={email} 
          onChange={e => setEmail(e.target.value)}
          required
          style={{ 
            flex: 1,
            minWidth: '220px', 
            padding: '0.6rem 0.75rem', 
            background: 'var(--bg-secondary)', 
            color: 'var(--foreground)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-sm)' 
          }}
        />
        <select 
          value={role} 
          onChange={e => setRole(e.target.value)}
          style={{ 
            padding: '0.6rem 0.75rem', 
            background: 'var(--bg-secondary)', 
            color: 'var(--foreground)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-sm)' 
          }}
        >
          <option value="badge_scanner">Badge Scanner</option>
          <option value="troop_admin">Troop Admin</option>
        </select>
        <button type="submit" disabled={!troopId || loading} className="btn btn-primary">
          {loading ? 'Sending...' : 'Send Invite'}
        </button>
      </form>
    </div>
  );
}
