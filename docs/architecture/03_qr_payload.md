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
4. **Unknown Member**: If no match is found for either ID, the scan is flagged in the UI as "Unknown Member". A modal lets the leader either manually enter a name (INSERT new roster row) or link the badge to an existing member.

## Targeted Single-Badge Linking (Roster Table)
Leaders can also link a physical badge directly to a specific roster member from the Roster table using `SingleBadgeScannerModal.jsx`:

1. User clicks **Scan Badge** on a specific member row.
2. `SingleBadgeScannerModal` opens camera view and reads the QR payload (`memberId | tlcId`).
3. Upon detection, it plays the success audio tone, displays the green checkmark overlay (`scan-overlay--success`), and returns `{ tlcId, memberId }`.
4. `RosterList` updates the targeted roster record in Supabase:
   - Sets `tlc_id = tlcId`
   - Sets `member_id = memberId` (if present in QR payload and not already set)
5. **Duplicate Badge Prevention**: If the `tlc_id` is already linked to another member in the troop, Supabase returns a `23505` unique constraint error. The UI catches this and displays a single-button modal alert (`confirm({ title: 'Duplicate Badge', message: '...', confirmText: 'OK', cancelText: null })`) naming the conflicting member.

> See [01_database_schema.md](./01_database_schema.md) for the full dual-ID strategy rationale and constraints.

## Bulk Badge Import (PDF Badges)
Leaders can bulk-link multiple badges at once from exported Trail Life Connect PDF badge files using `BulkBadgeImportModal.jsx`:

1. User clicks **Import Badges** on the Members tab toolbar.
2. User drops one or more badge `.pdf` files (or a full folder of badges).
3. The browser renders each PDF page 1 to an off-screen HTML `<canvas>` via **PDF.js** (CDN).
4. `html5-qrcode` decodes the QR code from the canvas blob image and parses the payload (`memberId | tlcId`).
5. Matching logic:
   - Matches against existing troop roster by `member_id` first, then `tlc_id`.
   - **Exact match with same `tlc_id`**: marked as `same` (skipped automatically to avoid redundant writes).
   - **Match with missing or different `tlc_id`**: marked as `ready` (overwrites with latest badge's `tlc_id`).
   - **No match**: marked as `no_match` and presented in a manual assignment dropdown.
   - **Decode failure**: marked as `unreadable` (leader advised to use single-badge scanner).
6. User reviews the categorized results and clicks **Link X Badges**.
7. Updates Supabase `roster` records with `tlc_id` (and backfills `member_id` if missing).


## Chrome Extension DOM Integration
The 12-character `tlc_id` is critical for the sync step. The Chrome Extension uses it to construct DOM selectors on the `traillifeconnect.com` attendance page:

```
#${tlcId}-${eventId}-attended
```

- `tlcId`: The 12-char alphanumeric string stored in `roster.tlc_id`.
- `eventId`: The Trail Life Connect internal event ID parsed from the current page.

**Without capturing and storing the `tlc_id` during the scan process, the automated sync clicking will fail.**

> See [06_chrome_extension.md](./06_chrome_extension.md) for full extension architecture and the DOM selector contract.

