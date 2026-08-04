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
        throw new Error(error.message || 'Failed to invite user');
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
    <div style={{ marginTop: '2rem', border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
      <h2>Invite Team Member</h2>
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
      {message && <div style={{ color: 'green', marginBottom: '1rem' }}>{message}</div>}

      <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input 
          type="email" 
          placeholder="Email address" 
          value={email} 
          onChange={e => setEmail(e.target.value)}
          required
          style={{ padding: '0.5rem', minWidth: '250px' }}
        />
        <select 
          value={role} 
          onChange={e => setRole(e.target.value)}
          style={{ padding: '0.5rem' }}
        >
          <option value="badge_scanner">Badge Scanner</option>
          <option value="troop_admin">Troop Admin</option>
        </select>
        <button type="submit" disabled={!troopId || loading} style={{ padding: '0.5rem 1rem' }}>
          {loading ? 'Sending...' : 'Send Invite'}
        </button>
      </form>
    </div>
  );
}
