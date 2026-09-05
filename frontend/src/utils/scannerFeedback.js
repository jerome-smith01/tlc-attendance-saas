/**
 * Formats a member's display name as "First Name" and "Last Initial." (e.g., "John D.")
 * 
 * @param {Object} member
 * @returns {string}
 */
export function formatMemberName(member) {
  if (!member) return '';
  const first = member.first_name || '';
  const lastInitial = member.last_initial
    ? (member.last_initial.endsWith('.') ? member.last_initial : `${member.last_initial}.`)
    : (member.last_name ? `${member.last_name.charAt(0)}.` : '');

  const parts = [first, lastInitial].filter(Boolean);
  return parts.join(' ').trim();
}

/**
 * Calculates display attributes (corners, text, icon type, ARIA announcement)
 * for scanner feedback states.
 * 
 * Corner color mapping:
 * - white: ready to scan
 * - green: scanned in
 * - blue: scanned out
 * - yellow: duplicate
 * 
 * @param {Object} params
 * @param {string} params.status - 'ready' | 'success' | 'offline_queued' | 'duplicate' | 'unknown'
 * @param {string} [params.mode] - 'IN' | 'OUT'
 * @param {Object} [params.member] - Member object with first_name, last_initial, etc.
 * @returns {Object}
 */
export function getScannerDisplayData({ status, mode = 'IN', member = null } = {}) {
  if (!status || status === 'ready') {
    return {
      cornerStatus: 'ready',
      displayText: '',
      type: null,
      ariaAnnouncement: ''
    };
  }

  const name = formatMemberName(member);

  if (status === 'success' || status === 'offline_queued') {
    const isOut = mode?.toUpperCase() === 'OUT';
    const cornerStatus = isOut ? 'out' : 'in';
    const actionText = isOut ? 'scanned out' : 'scanned in';
    const displayName = name || 'Member';

    return {
      cornerStatus,
      displayText: displayName,
      type: 'success',
      ariaAnnouncement: `${displayName} ${actionText}`
    };
  }

  if (status === 'duplicate') {
    const displayName = name || 'Member';
    return {
      cornerStatus: 'duplicate',
      displayText: displayName,
      type: 'warning',
      ariaAnnouncement: `Duplicate scan: ${displayName}`
    };
  }

  if (status === 'unknown') {
    return {
      cornerStatus: 'ready',
      displayText: 'Member not found',
      type: 'warning',
      ariaAnnouncement: 'Member not found'
    };
  }

  return {
    cornerStatus: 'ready',
    displayText: '',
    type: null,
    ariaAnnouncement: ''
  };
}
