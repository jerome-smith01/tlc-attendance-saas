import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './common/ToastContext';

export function InviteUser({ troopId, onInviteSent, onDuplicateInvite }) {
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('tlc_invite_section_open');
      return saved !== 'false';
    } catch (_) {
      return true;
    }
  });

  const [rows, setRows] = useState([
    { id: 'initial_row', email: '', role: 'badge_scanner', error: null }
  ]);
  const [loading, setLoading] = useState(false);

  // Pre-fetched sets for client-side duplicate detection
  const rosterEmailsRef = useRef(new Set());
  const pendingEmailsRef = useRef(new Set());

  useEffect(() => {
    try {
      localStorage.setItem('tlc_invite_section_open', String(isOpen));
    } catch (_) { }
  }, [isOpen]);

  // Fetch existing roster and pending invite emails whenever troopId changes
  useEffect(() => {
    if (!troopId) return;
    async function prefetchDuplicateEmails() {
      const [rosterRes, pendingRes] = await Promise.all([
        supabase.from('roster').select('email').eq('troop_id', troopId).not('email', 'is', null),
        supabase.from('pending_invites').select('email').eq('troop_id', troopId).gt('expires_at', new Date().toISOString()),
      ]);
      rosterEmailsRef.current = new Set(
        (rosterRes.data || []).map(r => r.email.toLowerCase())
      );
      pendingEmailsRef.current = new Set(
        (pendingRes.data || []).map(r => r.email.toLowerCase())
      );
    }
    prefetchDuplicateEmails();
  }, [troopId]);

  // Helper to extract email addresses from formatted strings like "Name <email@domain.com>" or delimited email lists
  function extractEmails(text) {
    if (!text || typeof text !== 'string') return [];
    
    // 1. Match valid email addresses (e.g. from "Name <email@domain.com>" or plain email lists)
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    
    if (matches && matches.length > 0) {
      return matches.map(e => e.trim());
    }

    // 2. Fallback: split by delimiters and strip angle brackets/quotes
    return text
      .split(/[;, \r\n]+/)
      .map(part => part.replace(/[<>"'\s]/g, '').trim())
      .filter(Boolean);
  }

  function handleEmailChange(id, value) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, email: value, error: null } : row));
  }

  function handleRoleChange(id, role) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, role } : row));
  }

  function checkDuplicateInline(email) {
    const lower = email.toLowerCase();
    if (rosterEmailsRef.current.has(lower)) {
      return 'This email is already on the leadership roster.';
    }
    if (pendingEmailsRef.current.has(lower)) {
      if (onDuplicateInvite) onDuplicateInvite(email);
      return 'An invite has already been sent to this email address.';
    }
    return null;
  }

  function handleBlur(id) {
    setRows(prevRows => {
      const index = prevRows.findIndex(r => r.id === id);
      if (index === -1) return prevRows;

      const targetRow = prevRows[index];
      const trimmed = (targetRow.email || '').trim();

      const parts = extractEmails(trimmed);

      let updated = [...prevRows];

      if (parts.length > 1) {
        const newSplitRows = parts.map((partEmail, i) => {
          const dupError = checkDuplicateInline(partEmail);
          return {
            id: i === 0 ? targetRow.id : `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`,
            email: partEmail,
            role: targetRow.role,
            error: dupError
          };
        });
        updated.splice(index, 1, ...newSplitRows);
      } else if (parts.length === 1) {
        const dupError = checkDuplicateInline(parts[0]);
        updated[index] = { ...targetRow, email: parts[0], error: dupError };
      } else {
        updated[index] = { ...targetRow, email: '', error: null };
      }

      return updated;
    });
  }

  function handleRemoveRow(id) {
    setRows(prev => {
      const filtered = prev.filter(r => r.id !== id);
      if (filtered.length === 0) {
        return [{ id: `${Date.now()}`, email: '', role: 'badge_scanner', error: null }];
      }
      return filtered;
    });
  }

  function handleAddRow(role, index) {
    setRows(prev => {
      const newRow = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: '',
        role: role,
        error: null
      };
      const updated = [...prev];
      updated.splice(index + 1, 0, newRow);
      return updated;
    });
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!troopId) return;

    // Process and expand any un-blurred email inputs
    let validRows = [];
    rows.forEach(row => {
      const trimmed = row.email.trim();
      if (!trimmed) return;
      const extracted = extractEmails(trimmed);
      if (extracted.length > 0) {
        extracted.forEach(email => {
          validRows.push({ ...row, email });
        });
      }
    });

    if (validRows.length === 0) {
      toast('Please enter at least one email address.', 'error');
      return;
    }

    setLoading(true);

    // Reset errors on all rows
    setRows(prev => prev.map(r => ({ ...r, error: null })));

    let successCount = 0;
    const failedIds = new Set();
    const rowErrors = {};

    const results = await Promise.allSettled(
      validRows.map(async row => {
        const { data, error } = await supabase.functions.invoke('invite-user', {
          body: {
            email: row.email.trim(),
            role: row.role,
            troop_id: troopId,
            site_url: window.location.origin
          }
        });

        if (error) {
          let errMsg = error.message;
          try {
            // Supabase functions invoke sometimes buries the response body in context
            const body = await error.context?.json?.();
            if (body?.error) errMsg = body.error;
          } catch (_) { }
          
          if (errMsg.includes('non-2xx status code') || !errMsg) {
            errMsg = 'An unexpected error occurred. Please try again.';
          }

          if (errMsg.toLowerCase().includes('already') && onDuplicateInvite) {
            onDuplicateInvite(row.email.trim());
          }

          throw { rowId: row.id, message: errMsg };
        }
        return { rowId: row.id, email: row.email };
      })
    );

    results.forEach(res => {
      if (res.status === 'fulfilled') {
        successCount++;
      } else {
        const reason = res.reason;
        if (reason && reason.rowId) {
          failedIds.add(reason.rowId);
          rowErrors[reason.rowId] = reason.message || 'Failed to send invite.';
        }
      }
    });

    if (successCount > 0) {
      toast(`Successfully sent invite to ${successCount} leader${successCount > 1 ? 's' : ''}`, 'success');
      // Add successfully invited emails to in-memory set so repeat entries are caught inline
      results.forEach(res => {
        if (res.status === 'fulfilled' && res.value?.email) {
          pendingEmailsRef.current.add(res.value.email.toLowerCase());
        }
      });
      if (onInviteSent) onInviteSent();
    }

    // Keep failed rows with their inline error messages, remove successful rows
    setRows(prev => {
      const remaining = prev.filter(r => failedIds.has(r.id) || r.email.trim() === '');
      const updated = remaining.map(r => rowErrors[r.id] ? { ...r, error: rowErrors[r.id] } : r);

      // Ensure at least one row remains
      if (updated.length === 0) {
        updated.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          email: '',
          role: 'badge_scanner',
          error: null
        });
      }
      return updated;
    });

    setLoading(false);
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Collapsible section title above card */}
      <div
        className="attendance-section-header"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setIsOpen(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
            Invite Troop Leaders
          </h3>
        </div>
      </div>

      {isOpen && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {rows.map((row, index) => {
                const canDelete = rows.length > 1 || row.email.trim() !== '';

                return (
                  <div key={row.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        inputMode="email"
                        placeholder="Email address(es)"
                        value={row.email}
                        onChange={e => handleEmailChange(row.id, e.target.value)}
                        onBlur={() => handleBlur(row.id)}
                        style={{
                          flex: '1 1 240px',
                          minWidth: '200px',
                          padding: '0.65rem 0.75rem',
                          background: 'var(--bg-secondary)',
                          color: 'var(--foreground)',
                          border: row.error ? '1px solid var(--color-error, #ef4444)' : '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem'
                        }}
                      />

                      {/* Radio button group for role */}
                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem', userSelect: 'none', color: 'var(--foreground)' }}>
                          <input
                            type="radio"
                            name={`role_${row.id}`}
                            value="badge_scanner"
                            checked={row.role === 'badge_scanner'}
                            onChange={() => handleRoleChange(row.id, 'badge_scanner')}
                            style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                          />
                          Badge Scanner
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem', userSelect: 'none', color: 'var(--foreground)' }}>
                          <input
                            type="radio"
                            name={`role_${row.id}`}
                            value="roster_manager"
                            checked={row.role === 'roster_manager'}
                            onChange={() => handleRoleChange(row.id, 'roster_manager')}
                            style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                          />
                          Roster Manager
                        </label>
                      </div>

                      {/* Add row button */}
                      <button
                        type="button"
                        onClick={() => handleAddRow(row.role, index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          lineHeight: 1,
                          padding: '0.2rem 0.4rem',
                          borderRadius: 'var(--radius-sm)'
                        }}
                        title="Add another"
                      >
                        +
                      </button>

                      {/* Remove row button */}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            lineHeight: 1,
                            padding: '0.2rem 0.4rem',
                            borderRadius: 'var(--radius-sm)'
                          }}
                          title="Remove row"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Inline error for this row */}
                    {row.error && (
                      <div style={{ color: 'var(--color-error, #ef4444)', fontSize: '0.78rem', paddingLeft: '0.25rem' }}>
                        {row.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Helper footnote */}
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Separate by commas, semi-colons, or spaces.
            </p>

            {/* Bottom action bar */}
            <div>
              <button
                type="submit"
                disabled={!troopId || loading}
                className="btn btn-compact btn-start"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
                {loading ? 'Sending...' : 'Invite'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

