import React from 'react';
import { Modal } from './common/Modal';

/**
 * Returns the number of whole days between today (local midnight) and a given ISO date string.
 * Negative values mean the date is in the past.
 */
function daysUntilExpiry(isoDateStr) {
  if (!isoDateStr) return null;
  // Parse as local date (YYYY-MM-DD) to avoid UTC midnight-shift issues
  const [year, month, day] = isoDateStr.split('-').map(Number);
  const expiry = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
}

/**
 * Format an ISO date string (YYYY-MM-DD) as a friendly display date, e.g. "Sep 6, 2026".
 */
function formatExpDate(isoDateStr) {
  if (!isoDateStr) return '';
  const [year, month, day] = isoDateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Blocking modal shown after a successful scan when the scanned member's
 * membership is expired or expiring within 30 days.
 *
 * Props:
 *   member    – roster row object (first_name, last_initial, membership_exp)
 *   onDismiss – called when the user taps OK
 */
export function MembershipExpiryModal({ member, onDismiss }) {
  if (!member || !member.membership_exp) return null;

  const days = daysUntilExpiry(member.membership_exp);
  if (days === null) return null;

  const isExpired = days < 0;
  const isExpiringSoon = days >= 0 && days <= 30;
  if (!isExpired && !isExpiringSoon) return null;

  const memberName = `${member.first_name || ''} ${member.last_initial || ''}.`.trim();
  const formattedDate = formatExpDate(member.membership_exp);

  const accentColor = isExpired ? 'var(--color-error, #dc2626)' : 'var(--color-warning, #d97706)';
  const bgColor = isExpired
    ? 'var(--color-error-subtle, rgba(220,38,38,0.08))'
    : 'var(--color-warning-subtle, rgba(217,119,6,0.08))';
  const icon = isExpired ? '🔴' : '🟡';

  const title = isExpired ? 'Membership Expired' : 'Membership Expiring Soon';

  const body = isExpired
    ? `${memberName}'s membership expired on ${formattedDate}. Please contact the member to renew before the next event.`
    : `${memberName}'s membership expires on ${formattedDate} (${days} day${days === 1 ? '' : 's'}). Please remind the member to renew.`;

  return (
    <Modal
      isOpen={true}
      onClose={onDismiss}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: accentColor }}>
          <span>{icon}</span>
          <span>{title}</span>
        </span>
      }
    >
      <div style={{ padding: '0.25rem 0' }}>
        <div
          style={{
            background: bgColor,
            border: `1px solid ${accentColor}`,
            borderRadius: '8px',
            padding: '0.875rem 1rem',
            marginBottom: '1.25rem',
            color: 'var(--foreground)',
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={onDismiss}
            autoFocus
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
}
