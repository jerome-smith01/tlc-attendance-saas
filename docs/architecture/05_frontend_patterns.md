# Key Frontend Patterns

This document explains the core patterns used in the React frontend that any developer or AI agent should understand before making changes. These are decisions with architectural significance — not just implementation details.

---

## 1. Auth Session Lifecycle (`AuthContext`)

**File**: `src/context/AuthContext.jsx`

The auth state has three possible values, each meaningful:

| `session` value | Meaning |
|:---|:---|
| `undefined` | Still loading — do not redirect or render protected content |
| `null` | Confirmed logged out — redirect to `/login` |
| `Session` object | Confirmed logged in |

**Why this matters for UI**: `ProtectedRoute` blocks render until `loading = false`. This prevents a flash of the login page when a returning PWA user already has a valid token in `localStorage`.

```js
// On boot — reads from localStorage before onAuthStateChange fires
supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(session);
  setLoading(false);
});

// Handles all future events: LOGIN, LOGOUT, TOKEN_REFRESH, SIGNED_OUT
supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session);
  setLoading(false);
});
```

**Exposed values**: `session`, `user` (shortcut for `session?.user`), `loading`, `signOut()`.

---

## 2. Troop Context & Multi-Troop Switching (`TroopContext`)

**File**: `src/context/TroopContext.jsx`

This context is critical for any multi-user or multi-troop scenario. It:
- Fetches all troops the authenticated user belongs to from `troop_users`.
- Checks the `global_admins` table to set the `isGlobalAdmin` flag.
- Tracks `needsOnboarding` boolean flag (`true` if any associated `troop_users` entry has `onboarding_completed = false`).
- Maintains shared `userDisplayName` state (formatted as `"FirstName L."`) and provides `refreshDisplayName()` to refresh display name from the `roster` table for the user and active troop.
- Exposes a `selectedTroopId` that drives all data queries on every page.
- Persists the selected troop in `localStorage` under `tlc_last_troop_id` so the user's selection survives page refreshes.

**Key rule**: Every page component (Dashboard, Roster, Events, Scanner) should consume `selectedTroopId` from `TroopContext` rather than fetching it directly. This ensures the troop switcher in the sidebar header controls the entire app context.

```js
const { selectedTroopId, selectedTroop, troops, isGlobalAdmin, needsOnboarding, userDisplayName, refreshDisplayName } = useTroop();
```

**Global Admin behavior**: When `isGlobalAdmin = true`, the `TroopContext` fetches all troops from the database (not just those in `troop_users`) and makes them available in the troop switcher.

---

## 3. Protected Routes & Onboarding Flow

**Files**: `src/components/ProtectedRoute.jsx`, `src/pages/Profile.jsx`

Public routes (`/` for Landing Page, `/login`, `/accept-invite`) do not require authentication. All protected routes are wrapped in `<ProtectedRoute>`. This component:
1. Waits for `loading = false` before rendering anything.
2. If `session = null`, silently redirects to `/login`.
3. Otherwise renders `<SidebarLayout>` with `<Outlet/>` for page content.

### URL Routing & Browser Back Button Standard
Every distinct view state, tab, or screen MUST have its own unique URL (e.g., `/troop/:troopNumber/dashboard`, `/troop/:troopNumber/roster/members`, `/troop/:troopNumber/events`, `/troop/:troopNumber/events/:eventId`, `/troop/:troopNumber/billing`, `/profile`).
- **Troop-Scoped URLs**: All primary app routes encode the user-friendly troop identifier (`troop_number` such as `DEMO-001` or `SC-0110`) in the path hierarchy (e.g. `/troop/DEMO-001/dashboard`, `/troop/DEMO-001/events`, `/troop/DEMO-001/billing`).
- **Two-Way URL & Context Sync**: Route parameters (`:troopNumber`) automatically synchronize with `TroopContext.selectedTroopId` via `selectTroopByNumberOrId`.
- **Navigation History**: Section and tab transitions add distinct history entries so browser Back and Forward buttons navigate seamlessly across all app sections.
- **Legacy Route Compatibility**: Generic paths (e.g. `/dashboard`, `/roster`, `/events`, `/billing`) automatically redirect to their troop-scoped equivalents based on the user's active troop.

### Onboarding & Profile Setup (`/profile`)
When a new user accepts a Supabase email invite, they land on `/profile` (or are redirected from `/complete-profile`). This page:
1. Checks `roster` for an existing row where `user_id = auth.uid()` for the selected troop.
2. If found, pre-fills `first_name`, `last_initial`, and `member_id`.
3. Allows the user to set or update their display name, member ID, password, and link/scan their badge.
4. On submit, updates their name across all their `roster` affiliations, sets `member_id` for the active troop, and marks `troop_users.onboarding_completed = true`.

**Important**: The `roster` table has an RLS policy (`"Users can update their own roster entry"`) that allows users to update their own row even without a `troop_admin` role. This is what makes self-onboarding and profile management possible.

---

## 4. Scan Logic (`useScanLogic`)

**File**: `src/hooks/useScanLogic.js`

The core scanning logic is encapsulated in a custom hook to keep `Scanner.jsx` focused on camera lifecycle and UI state. The hook handles:

1. **3-second cooldown**: Uses `useRef` to track the last scan time per QR ID, preventing duplicate inserts from a badge held in frame.
2. **Roster lookup**: Resolves the QR payload to a roster entry using the priority sequence: `tlc_id` → `member_id`.
3. **`tlc_id` backfill**: If a match is found via `member_id` but `roster.tlc_id` is null, an UPDATE is issued immediately.
4. **Unknown member handling**: If no match is found, returns the raw payload to the parent `Scanner.jsx` component, which shows a modal for manual resolution.
5. **Supabase write**: Inserts a `scans` row with `status = pending`.

```js
// Cooldown guard pattern
const lastScanRef = useRef({});
function handleScan(rawPayload) {
  const now = Date.now();
  if (now - (lastScanRef.current[rawPayload] ?? 0) < 3000) return; // 3s cooldown
  lastScanRef.current[rawPayload] = now;
  // ... proceed with lookup and insert
}
```

### 4.1 Camera Viewport Optimization

To prevent excessive CPU/GPU usage and battery drain on mobile devices, live camera feeds are monitored using an `IntersectionObserver`. 
- When the camera container (`#qr-reader`) scrolls out of the visible viewport, `html5QrCode.pause()` is invoked to suspend video processing.
- When it re-enters the viewport, `html5QrCode.resume()` is called to seamlessly resume scanning.
- Upon page unmount / navigation away, `html5QrCode.stop()` is triggered to release the camera hardware completely.

---

## 5. Screen Headers & Header Cards

To provide a consistent and premium experience across major screens (e.g., Scanner, Event Details), the app uses a sticky header and a primary header card pattern:

### 5.1 Pinned Sticky Title Bar (`.scanner-sticky-title`)
- Floats directly on the page background at the top (`position: sticky; top: 0; z-index: 50;`).
- Contains the Back button (left) and the Event/Screen Name (center or right).
- Uses a glassmorphism blur effect (`backdrop-filter: blur(8px);`) to ensure scrolling content is legible underneath.
- Does **not** include redundant global buttons (like ThemeToggle) if they exist in the top navbar.

### 5.2 Header Card (`.scanner-header-card`)
- Appears directly beneath the sticky title bar and scrolls away with the page body.
- Replaces generic glass cards with a dense, structured layout for key entity metadata.
- **Field Layout**: Formatted as individual full-width rows (`display: flex; justify-content: space-between; align-items: center;`).
- **Alignment**: Labels (`.grid-table-label`) are left-aligned; values and status badges are right-aligned on the same row.
- **Metrics Hierarchy**:
  - **STATUS**: Session status pill badge (`OPEN`, `CLOSED`, or `SYNCED`).
  - **EVENT DATE**: Formatted event date string.
  - **SCANNED IN**: Real-time count of members currently active / signed in (`attendance.filter(s => !s.raw_sign_out_time).length`).
  - **SCANNED OUT**: Count of members signed out (`attendance.filter(s => !!s.raw_sign_out_time).length`).
  - **SCANNED TOTAL**: Total scans recorded (`[scanned in] + [scanned out]`).
- **Metric Styling**: `SCANNED IN`, `SCANNED OUT`, and `SCANNED TOTAL` render as plain text (`color: var(--text-secondary)`), without colored background badge pills. The legacy "Offline Queue" row and popover description are removed from the header card.
- **Action Buttons (`.btn-compact`)**: Rendered inside the header card or immediately below it, using compact padding (`padding: 0.4rem 0.85rem`) and text sizing to group primary screen actions (e.g., Scan, Photos, Add).

### 5.3 Page Outer Wrapper (`maxWidth: 1400px`)
All major top-level page views (Events, Scanner, Dashboard, Roster, Billing) MUST wrap their main content in an outer container enforcing the canonical desktop max-width constraint:
```jsx
<div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>
```
This guarantees consistent layout margins, prevents wide stretched layouts on high-resolution screens, and keeps visual alignment uniform across navigation transitions.

### 5.4 Top Layout Header Shell (`SidebarLayout.jsx`)
The application shell uses a full-width header layout:
- `.layout-root` uses `flex-direction: column` so the top navbar (`.layout-header`) stretches 100% across the viewport width above both the sidebar navigation and main content area (`.layout-content`).
- **Brand Identity**: Displays the 32x32px logo (`/logo.png`) alongside the `.header-title` ("TLC Attendance").
- **Mobile Responsive Hiding**: On mobile viewports (`max-width: 767px`), CSS rules hide `.header-title` and `.active-troop-label` so only the hamburger toggle button, logo image, and troop switcher dropdown are visible in the header bar.

---

## 6. Design System & Theming

**Files**: `src/styles/global.css`, `src/hooks/useTheme.js`, `src/components/ThemeToggle.jsx`

- All colors, spacing, and visual tokens are CSS custom properties defined in `global.css`.
- Light theme: `:root { --bg-primary: ...; --text-primary: ...; }`.
- Dark theme: `.dark { --bg-primary: ...; --text-primary: ...; }`.
- `useTheme` hook reads OS preference via `prefers-color-scheme` on first load, then persists the user's explicit choice in `localStorage` under `tlc-theme`.
- The `.dark` class is toggled on the `<html>` element. No component uses hardcoded colors.
- This design system is shared with the `jerome-portfolio` project for visual consistency.

---

## 7. Error Handling Security

All pages follow this security pattern for Supabase errors:

```js
// In production: generic message shown to user
setError('Something went wrong. Please try again.');
// Always: log the real error to console for debugging
console.error('Supabase error:', error.message);
```

The `supabaseClient.js` singleton does not expose the Supabase URL or anon key in error output in production builds.

---

## 8. SPA Routing for Cloudflare Pages

`HashRouter` is used instead of `BrowserRouter` because Cloudflare Pages serves from a CDN. Without hash routing, direct navigation to `/#/dashboard` would return the React app's `index.html` correctly without needing server-side redirects. A `public/_redirects` file (`/* /index.html 200`) is also in place as a fallback for any path-based routing edge cases.

---

## 9. Scanner UI Patterns (Live, Manual & Photo)

**File**: `src/pages/Scanner.jsx`

The Scanner UI contains features to augment standard QR scanning alongside the live-camera flow. These actions are surfaced in the `.scanner-actions-panel` side cards positioned to the right of the camera feed:

### Camera Viewfinder & State Toggle
- The live camera `#qr-reader` is contained within `.scanner-feed-container` with a centered 200x200px strict square viewfinder (`.scanner-strict-square`), corner bracket accents (`.scanner-corner-in` / `.scanner-corner-out`), and a single-pass animated scan line (`.scan-line-active`).
- **Dynamic Camera Mode Badge (`.scanner-live-badge`)**: Positioned at the top-right of the active camera feed, replacing the generic `LIVE` badge with a mode-aware status indicator:
  - When scanning in (`scanMode === 'IN'`), renders **`SCANNING IN`** with a green pulsing dot (`#10b981`) and green badge styling (`.badge-success`).
  - When scanning out (`scanMode === 'OUT'`), renders **`SCANNING OUT`** with a blue pulsing dot (`#3b82f6`) and blue badge styling (`.badge-info`).
- **Unobscured Viewfinder Overlay**: The inner viewfinder mode label overlay tag (`.scanner-mode-overlay-tag`, which previously displayed "Signing In" or "Signing Out" in the center of the camera square) was removed to provide an unobscured video stream for QR recognition.
- **Idle Overlay (`.scanner-idle-overlay`)**: When camera scanning is inactive, camera rendering is paused to save battery, displaying an idle camera icon, title `"Scanner Idle"`, and subtitle `"Camera is paused to save battery."`. The standalone `SCAN` button inside the idle viewfinder placeholder was removed to prevent duplicate triggers; scanning activation is driven directly by the equal-width `SCAN IN` / `SCAN OUT` buttons in the action panel.
- **Scanning Controls & Mode Switch Workflow**: Pressing **"SCAN IN"** (`.scanner-btn-in`) or **"SCAN OUT"** (`.scanner-btn-out`) activates the camera feed. While scanning is active, only the red **"STOP SCANNER"** (`.btn-destructive`) button is rendered. To switch between Scan In and Scan Out modes, the user must first stop the active scanner session.

### Scanner Action Panel & Secondary Actions Container
- **Single Consolidated Card (`.scanner-action-card`)**: Consolidates top action buttons, optional scanner sound toggle switch (`.scanner-toggle-switch`), and secondary options into a single card container with rounded corners (`16px`), light border (`#e2e8f0`), and subtle shadow.
- **Equal-Width Primary Buttons**: `SCAN IN` (`.scanner-btn-in`, `#48bb78` green) and `SCAN OUT` (`.scanner-btn-out`, `#4c7cf3` blue) are configured with `flex: 1; flex-basis: 0;` so both buttons occupy exactly 50% equal width across the top row inside the card.
- **Icon Orientations**:
  - **`SCAN IN`**: Right-pointing arrow entering into a right-hand bracket (`->]`).
  - **`SCAN OUT`**: Right-pointing arrow exiting out of a left-hand bracket (`[->`).
- **Secondary Actions Box (`.scanner-secondary-actions-box`)**: An inner container box placed directly below the primary buttons row. Features a green vertical left accent bar (`border-left: 3.5px solid #10b981`), light background (`var(--bg-tertiary, #f8fafc)`), rounded corners (`12px`), and border (`1px solid #e2e8f0`).
  - **Item 1 - Check in from Photos**: Photo icon in a white square badge box (`.scanner-action-icon-box`), title `Check in from Photos`, subtitle `Upload badge photos to scan`, with invisible file input overlay.
  - **Item 2 - Check in from Roster**: User-plus icon in a white square badge box (`.scanner-action-icon-box`), title `Check in from Roster`, subtitle `Select trailmen from a list`, with onClick opening manual roster entry modal.

### Manual Search Modal ("Check in from Roster" Item)
Allows users to add attendance for someone who forgot their badge or is a new guest. (See [09_popup_modals.md](./09_popup_modals.md) for overall popup modal architecture).
- Triggered by the **"Check in from Roster"** list item (`Select trailmen from a list`) in the secondary action box.
- Displayed via `Modal` component controlled by `isManualEntryOpen` state.
- **Existing Member**: Selects an existing roster member (where `attendance` does not already contain a scan for that `roster_id`), inserting a `scans` row immediately.
- **New Member/Guest**: Performs a `supabase.from('roster').insert()` to create the member record, retrieves the newly generated `id`, updates local roster state, and then records the scan.

### Scan from Photo / Bulk Upload ("Check in from Photos" Item)
Allows uploading multiple photos containing QR codes from the device's camera roll or local files.
- Triggered via an invisible file input (`<input type="file" multiple accept="image/*">`) wrapped by the **"Check in from Photos"** list item (`Upload badge photos to scan`) in the secondary action box.
- Processed sequentially via `handleBulkPhotos`: for each selected file, an instance of `Html5Qrcode` is created (or reused) and `html5Qrcode.scanFile(file, true)` is invoked to decode the QR code payload without activating camera video feeds.
- Extracted payloads are passed directly into `handleScan` / `processScanPayload`, triggering the exact same validation, lookup, offline queueing, and state update pipeline as live scanning.

---

## 10. Reusable `DataTable` Component

**File**: `src/components/common/DataTable.jsx`

A fully-featured, user-configurable standard HTML table component used for simple tabular views or secondary data lists. (Primary management screens like Events, Sessions, and Roster use the Pattern 07 responsive grid table architecture). Its state is persisted to `localStorage` per-user, per-table.

### Props

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `columns` | `Array<Column>` | required | Column definitions (see below) |
| `data` | `Array<Object>` | required | Array of row objects |
| `storageKey` | `string` | — | **Required for persistence.** A unique key (e.g., `"sessions"`, `"roster"`, `"session-attendees"`) stored under `tlc_datatable_<storageKey>_<userId>` in localStorage |
| `searchable` | `boolean` | `true` | Toggles the global search input |
| `onRowClick` | `function` | — | If provided, rows gain `cursor: pointer` and call this function with the row data on click |

### Column Definition Format

```js
{
  label: 'Event Name',            // Header text displayed in <th>
  key: 'event_name',              // Property name on the row object; also used as sort key
  render: (val, row) => <JSX />  // Optional custom cell renderer
}
```

> **Known gap**: The `keyField` prop is accepted by callers but silently ignored — rows key on `row.id || idx` internally. This is a minor issue with no functional impact.

### Usage Pattern

```jsx
// Always provide storageKey to enable column persistence
<DataTable
  data={sessions}
  columns={sessionColumns}
  keyField="id"
  storageKey="sessions"
/>
```

### Persistence Mechanism

State is written to `localStorage` on every change via a `useEffect`. On mount, the component reads saved state and merges it with the default, making column reorders and visibility toggles survive page refreshes and re-mounts.

---

## 11. Session Purge Threshold & Warning Banner

**File**: `src/pages/Dashboard.jsx`

The session purge window is **30 days** from the session's `event_date`. This constant is defined inline as `MAX_DAYS = 30` in `Dashboard.jsx`.

Warning banners appear only for **unsynced** sessions (`session.synced_at === null`) and follow a two-tier escalation:

| Days Remaining | Banner Style | Label |
|:---|:---|:---|
| > 14 days | Hidden | — |
| 8–14 days | Amber left-border (`var(--color-warning)`) | **Warning:** |
| ≤ 7 days | Red left-border (`var(--color-error)`) | **Urgent Warning:** |
| ≤ 0 days | Red left-border (`var(--color-error)`) | **Urgent Warning:** + overdue copy |

The Sessions page subtitle mirrors this with the copy: *"Synced session data is automatically purged after 30 days."*

> **Developer simulation**: To test warning banners locally without waiting for real sessions to age, temporarily hardcode `const diffDays = 20;` (for 10 days left, amber) or `const diffDays = 25;` (for 5 days left, red) in the `sessions.map` loop in `Dashboard.jsx`.

---

## 12. User Profile & Security Settings Pattern (`Profile.jsx`)

**File**: `src/pages/Profile.jsx`

The `/profile` route manages account credentials, personal display names, troop roster affiliations, and physical badge links.

### 12.1 Modular Independent Cards
The page renders independent section cards wrapped in `.profile-page-wrapper`:
1. **Personal Information**: Allows users to update `first_name`, `last_initial`, and `member_id`. Submitting updates roster records across all user troop affiliations in `troop_users` and handles onboarding completion if pending.
2. **Account Details**: Renders read-only views for system `email` and assigned `role` using `.form-control-readonly` with lock icons and neutral badges.
3. **Security (Password)**: Provides password management requiring Current Password, New Password, and Confirm New Password fields.
4. **Badge Management**: Displays physical badge link status (`tlc_id`), with actions to view Trail Life Connect profile, unlink badge, or scan a new badge.
5. **Danger Zone**: Renders administrative account options.

### 12.2 Password Security Re-Authentication Pattern
Before invoking `supabase.auth.updateUser({ password })`, the application verifies the current password by issuing `supabase.auth.signInWithPassword({ email, password: currentPassword })`. If re-authentication fails, an inline toast notification (`Current password is incorrect.`) alerts the user without mutating auth state.

---

## 13. Scanner Viewfinder & Controls Layout Pattern (`Scanner.jsx`)

**File**: `src/pages/Scanner.jsx`

The event scanner layout pairs live camera QR recognition with high-visibility action controls and event session metadata.

### 13.1 Layout Architecture
- **Header Card (`.scanner-header-card`)**: Positioned at the top or side of the scanner layout, presenting Event Date, Session Status (Open/Closed/Synced), and real-time metric counters (`SCANNED IN`, `SCANNED OUT`, `SCANNED TOTAL`) rendered as plain text.
- **Top Camera Feed (`.scanner-feed-container`)**: Contains the live camera container (`#qr-reader`) set inside a glass card.
  - **Dynamic Mode Badge (`.scanner-live-badge`)**: Rendered at the top-right of the active camera view, displaying **`SCANNING IN`** (green dot `#10b981`, `.badge-success`) or **`SCANNING OUT`** (blue dot `#3b82f6`, `.badge-info`).
  - **Strict Square Viewfinder (`.scanner-strict-square`)**: Features a centered 1:1 aspect-ratio viewport with corner bracket accents (`.scanner-corner-in` green or `.scanner-corner-out` blue) and backdrop dimming overlay. The inner viewfinder mode tag has been removed for a clean video feed.
  - **Single-Pass Scan Line (`.scan-line-active`)**: A custom CSS `@keyframes scan-single` animation that sweeps top-to-bottom across the viewfinder once per scan cycle.
  - **Idle Overlay (`.scanner-idle-overlay`)**: Pauses camera rendering when idle or scrolled out of view to optimize battery consumption.
- **Action Panel Side Cards (`.scanner-actions-panel`)**: Positioned directly to the right of the camera feed on desktop (or stacked below on mobile):
  - **Single Consolidated Action Card (`.scanner-action-card`)**: Renders `SCANNER ACTIONS` header label with an optional sound toggle switch (`.scanner-toggle-switch`):
    - **Header Right Sound Toggle**: Switches scanner sound effects on/off. Muted state displays a grey mute icon (`#94a3b8`); active state displays a green sound-wave icon (`#10b981`).
    - **Default & Persistence**: Defaults to muted (`false`), persisting user setting across browser sessions in `localStorage` under key `'scanner_sound_enabled'`.
    - **Stale Closure Prevention Pattern**: Audio playback functions (`playSuccessSound`, `playWarningSound`, `playErrorSound`) dynamically evaluate `localStorage.getItem('scanner_sound_enabled') === 'true'` on every invocation.
  - **Primary Scan Controls**:
    - **Idle State**: Renders equal-width `SCAN IN` (`.scanner-btn-in`, `#48bb78` green) and `SCAN OUT` (`.scanner-btn-out`, `#4c7cf3` blue) buttons to initiate scanning in the desired mode. Buttons specify `flex: 1; flex-basis: 0;` so both buttons occupy 50% width in the row.
      - **`SCAN IN` Icon**: Right-pointing arrow entering into a right-hand bracket (`->]`).
      - **`SCAN OUT` Icon**: Right-pointing arrow exiting out of a left-hand bracket (`[->`).
    - **Active State**: Renders a single full-width `STOP SCANNER` (`.btn.btn-destructive`) button. Mode switching during active camera streaming is disabled; users must tap `STOP SCANNER` to stop the session before switching modes.
  - **Secondary Actions Box (`.scanner-secondary-actions-box`)**: An inner container box placed directly below the primary buttons row. Features a green vertical left accent bar (`border-left: 3.5px solid #10b981`), light background (`var(--bg-tertiary, #f8fafc)`), rounded corners (`12px`), and border (`1px solid #e2e8f0`).
    - **Check in from Photos**: Photo icon in a white square badge box (`.scanner-action-icon-box`), title `Check in from Photos`, subtitle `Upload badge photos to scan` (triggers file upload).
    - **Check in from Roster**: User-plus icon in a white square badge box (`.scanner-action-icon-box`), title `Check in from Roster`, subtitle `Select trailmen from a list` (opens manual roster entry modal).
  - **Delete Event Button (`.scanner-btn-delete`)**: Placed below `scanner-action-card` in `.scanner-actions-panel`, aligned right-flush (`alignSelf: 'flex-end'`). Renders with red background (`var(--color-error)`), trash SVG icon, uppercase label `DELETE EVENT`, and auto width (`width: auto`).

### 13.2 Manual Attendance Status Toggle & Confirmation Pattern
When an authorized user (`isGlobalAdmin`, `troop_admin`, `billing_admin`, `admin`, `leader`) toggles a member's attendance status in the scanner attendance grid (`handleToggleScanStatus`):
1. **Confirmation Modal Prompt**: Prompts for confirmation via `confirm(...)` displaying title `Sign Member Back In` / `Sign Member Out` and explicitly showing the member's full name (`memberName`).
2. **Database Update & Toast**: Updates `sign_out_time`, `signed_out_by`, and `status` in Supabase, then displays a toast confirmation containing `${memberName} marked as Signed In / Signed Out`.

---

## 14. Password Strength Meter Pattern (`PasswordStrengthMeter.jsx`)

**File**: `src/components/PasswordStrengthMeter.jsx`

The `PasswordStrengthMeter` component provides reusable, client-side password security scoring and real-time requirement feedback across authentication and account creation flows (such as invitation acceptance and profile security updates).

### 14.1 Password Rules & Minimum Helper
The exported helper function `passwordMeetsMinimum(password)` gates form submit buttons. A password meets minimum security standards if and only if all three rules are satisfied:
1. **Length**: At least 8 characters (`password.length >= 8`)
2. **Uppercase**: At least 1 uppercase letter (`/[A-Z]/`)
3. **Number or Special Character**: At least 1 number or special character (`/[0-9]/` or `/[^A-Za-z0-9]/`)

```js
import { PasswordStrengthMeter, passwordMeetsMinimum } from '../components/PasswordStrengthMeter';

// Example: submit button gating
<button disabled={!passwordMeetsMinimum(password)}>Submit</button>
```

### 14.2 Visual Scoring & Rule Checklist
The component evaluates the password against a 4-level scoring scale and renders:
- **Color-Coded Strength Bar**:
  - `Weak` (Red: `var(--color-error)`): 0 or 1 rule met, or empty.
  - `Fair` (Orange: `var(--color-warning)`): 2 rules met.
  - `Strong` (Green: `var(--color-success)`): All 3 rules met.
  - `Very Strong` (Emerald `#10b981`): All 3 rules met + extra length (≥ 12 chars) or both number and special character.
- **Inline Checklist (`✓`/`✗`)**: Displays status indicator icons and labels for each rule, updating dynamically in green (`var(--color-success)`) when met and muted gray (`var(--muted-foreground)`) when unfulfilled.
