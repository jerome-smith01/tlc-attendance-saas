/**
 * Safely compares two expiration dates (ISO string 'YYYY-MM-DD' or null/empty).
 * Null or empty dates are sorted to the bottom regardless of sort direction.
 * 
 * @param {object|string} a - First member object or date string
 * @param {object|string} b - Second member object or date string
 * @param {'asc'|'desc'} direction - Sort direction ('asc' | 'desc')
 * @returns {number} Comparison result (-1, 0, 1)
 */
export function compareExpirationDate(a, b, direction = 'asc') {
  const dateA = typeof a === 'object' && a !== null ? a.membership_exp : a;
  const dateB = typeof b === 'object' && b !== null ? b.membership_exp : b;

  const hasA = Boolean(dateA && String(dateA).trim());
  const hasB = Boolean(dateB && String(dateB).trim());

  // If both missing, equal
  if (!hasA && !hasB) return 0;
  // Missing dates sort to the bottom regardless of asc/desc
  if (!hasA) return 1;
  if (!hasB) return -1;

  const strA = String(dateA).trim();
  const strB = String(dateB).trim();

  const comparison = strA.localeCompare(strB);

  return direction === 'asc' ? comparison : -comparison;
}
