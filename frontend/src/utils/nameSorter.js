/**
 * Comparator for sorting members by First Name or Last Initial.
 * Handles both scan items (where attendee details are in item.member)
 * and direct roster items (where item.first_name and item.last_initial are at root level).
 *
 * @param {object} a - First record (scan item or roster member)
 * @param {object} b - Second record (scan item or roster member)
 * @param {'first'|'last'} [field='first'] - Sort primarily by first name or last initial
 * @param {'asc'|'desc'} [direction='asc'] - Sort direction
 * @returns {number} Standard comparator result (-1, 0, 1)
 */
export function compareMemberName(a, b, field = 'first', direction = 'asc') {
  const memberA = a?.member || a || {};
  const memberB = b?.member || b || {};

  const isLast = field === 'last';

  // Primary and secondary fields based on sort field choice
  const primaryA = (isLast ? (memberA.last_initial || '') : (memberA.first_name || '')).trim();
  const primaryB = (isLast ? (memberB.last_initial || '') : (memberB.first_name || '')).trim();

  const secondaryA = (isLast ? (memberA.first_name || '') : (memberA.last_initial || '')).trim();
  const secondaryB = (isLast ? (memberB.first_name || '') : (memberB.last_initial || '')).trim();

  const cmpPrimary = primaryA.localeCompare(primaryB, undefined, { sensitivity: 'base' });
  if (cmpPrimary !== 0) {
    return direction === 'asc' ? cmpPrimary : -cmpPrimary;
  }

  const cmpSecondary = secondaryA.localeCompare(secondaryB, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? cmpSecondary : -cmpSecondary;
}
