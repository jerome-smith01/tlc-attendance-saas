/**
 * Helper functions for parsing QR payloads, matching roster members,
 * and calculating canvas cropping boundaries for PDF badge processing.
 */

/**
 * Parse TLC QR payload → { memberId, tlcId }.
 * Formats: "memberId | tlcId" or a single token.
 */
export function parseQrPayload(raw) {
  if (!raw) return { memberId: null, tlcId: null };
  const parts = String(raw).split('|').map(p => p.trim());
  if (parts.length >= 2) return { memberId: parts[0] || null, tlcId: parts[1] || null };
  return { memberId: null, tlcId: parts[0] || null };
}

/**
 * Match decoded QR to a roster entry: member_id first, then tlc_id.
 */
export function findRosterMatch(roster = [], memberId, tlcId) {
  if (!Array.isArray(roster)) return null;
  if (memberId) {
    const m = roster.find(r => r.member_id && String(r.member_id).trim() === String(memberId).trim());
    if (m) return m;
  }
  if (tlcId) {
    const m = roster.find(r => r.tlc_id && String(r.tlc_id).trim() === String(tlcId).trim());
    if (m) return m;
  }
  return null;
}

/**
 * Calculate multi-region crop boundaries for standard A4 / portrait TLUSA ID cards.
 *
 * 1. bottomRightQuadrant: The "FRONT" card face where Trail Life logo & QR code reside.
 * 2. bottomHalf: Covers lower half in case of shifting alignment or margin differences.
 * 3. full: The entire uncropped page.
 */
export function getCropRegions(width, height) {
  const w = Math.max(0, width);
  const h = Math.max(0, height);

  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);

  return {
    bottomRightQuadrant: {
      sx: halfW,
      sy: halfH,
      sw: w - halfW,
      sh: h - halfH,
    },
    bottomHalf: {
      sx: 0,
      sy: halfH,
      sw: w,
      sh: h - halfH,
    },
    full: {
      sx: 0,
      sy: 0,
      sw: w,
      sh: h,
    },
  };
}
