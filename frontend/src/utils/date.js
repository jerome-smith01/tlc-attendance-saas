/**
 * Formats a date string (ISO format YYYY-MM-DD or full ISO) into m/d/yy (e.g. 8/9/26).
 * 
 * @param {string} dateStr - Date string to format
 * @returns {string} Formatted date string (m/d/yy)
 */
export function formatAppDate(dateStr) {
  if (!dateStr) return '';
  // Ensure we extract the YYYY-MM-DD portion safely
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  
  if (parts.length === 3) {
    const year = parts[0].slice(-2);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(month) && !isNaN(day) && year) {
      return `${month}/${day}/${year}`;
    }
  }
  
  // Fallback to JS Date object if parsing hyphenated format failed
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = String(d.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}
