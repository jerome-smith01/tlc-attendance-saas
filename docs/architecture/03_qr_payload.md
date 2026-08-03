# QR Payload Parsing

## Source of QR Codes
Trail Life Connect Member Profile → **Print ID Card**. The QR code is printed directly on the physical youth badge.

## Payload Format
The QR payload format extracted from the original Google Sheets app:
- **Full format**: `"memberId | tlcId"` (pipe-delimited with surrounding spaces)
- **Bare `memberId`**: Just the member ID string
- **Bare `tlcId`**: Just the TLC ID string

## Parsing Contract
Pseudocode for the parsing logic in the scanner:

```javascript
const parts = String(rawPayload).split(' | ');
const memberId = parts[0].trim();
const tlcId = parts.length >= 2 ? parts[1].trim() : '';
```

## Roster Lookup Logic
When a badge is scanned, the application resolves it to a roster entry using this sequence:

1. **Check TLC ID**: If `tlcId` is present, search the `roster` table WHERE `tlc_id = tlcId` AND `troop_id = current_troop`.
2. **Check Member ID**: If no match is found, and `memberId` is present, search the `roster` table WHERE `member_id = memberId` AND `troop_id = current_troop`.
3. **Backfill TLC ID**: If a match is found via `member_id`, but `roster.tlc_id IS NULL`, the application immediately issues an UPDATE to save the `tlc_id` into that roster row. This ensures future scans match instantly.
4. **Unknown Member**: If no match is found for either ID, the scan is flagged in the UI as "Unknown Member", allowing the leader to resolve it manually or add a new roster entry on the fly.

## Chrome Extension DOM Integration
The 12-character `tlc_id` is critical. It is used by the Chrome Extension to construct DOM selectors on the `traillifeconnect.com` attendance page:
`#${tlcId}-${eventId}-attended`

Without capturing and storing the `tlc_id` during the scan process, the automated sync clicking will fail.
