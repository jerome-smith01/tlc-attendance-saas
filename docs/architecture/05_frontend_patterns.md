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
- Exposes a `selectedTroopId` that drives all data queries on every page.
- Persists the selected troop in `localStorage` under `tlc_last_troop_id` so the user's selection survives page refreshes.

**Key rule**: Every page component (Dashboard, Roster, Events, Scanner) should consume `selectedTroopId` from `TroopContext` rather than fetching it directly. This ensures the troop switcher in the sidebar header controls the entire app context.

```js
const { selectedTroopId, selectedTroop, troops, isGlobalAdmin } = useTroop();
```

**Global Admin behavior**: When `isGlobalAdmin = true`, the `TroopContext` fetches all troops from the database (not just those in `troop_users`) and makes them available in the troop switcher.

---

## 3. Protected Routes & Onboarding Flow

**Files**: `src/components/ProtectedRoute.jsx`, `src/pages/Profile.jsx`

All routes except `/login` are wrapped in `<ProtectedRoute>`. This component:
1. Waits for `loading = false` before rendering anything.
2. If `session = null`, silently redirects to `/login`.
3. Otherwise renders `<SidebarLayout>` with `<Outlet/>` for page content.

### URL Routing & Browser Back Button Standard
Every distinct view state, tab, or screen MUST have its own unique URL (e.g., `/roster/members`, `/roster/leaders`, `/roster/:memberId/edit`, `/profile`).
- Tab clicks must trigger router navigation (e.g. `navigate('/roster/members')`) rather than purely internal `useState` switching.
- Root route paths (e.g., `/roster`) redirect automatically to their default tab/sub-route (e.g. `/roster/members`), and `/complete-profile` redirects to `/profile`.
- This guarantees browser Back and Forward history buttons function correctly across all sub-views and tabs.

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

The Scanner UI contains features to augment standard QR scanning alongside the live-camera flow. These actions are surfaced as `.btn-compact` buttons below the Header Card:

### Expandable Camera Viewfinder
- The live camera `#qr-reader` is wrapped in an expandable accordion-style container (`max-height` transition).
- When the **"Scan"** button (`.btn-start`) is pressed, it smoothly expands and automatically scrolls into the center of the viewport via a `useEffect` auto-scroll hook.
- When active, the Scan button transforms into a red **"Stop Scan"** button (`.btn-destructive`).

### Manual Entry Modal ("Add" Button)
Allows users to add attendance for someone who forgot their badge or is a new guest. (See [09_popup_modals.md](./09_popup_modals.md) for overall popup modal architecture).
- Triggered by the compact **"Add"** button (`+`) in the header card.
- Displayed via `Modal` component controlled by `isManualEntryOpen` state.
- **Existing Member**: Selects an existing roster member (where `attendance` does not already contain a scan for that `roster_id`), inserting a `scans` row immediately.
- **New Member/Guest**: Performs a `supabase.from('roster').insert()` to create the member record, retrieves the newly generated `id`, updates local roster state, and then records the scan.

### Photo Scan / Bulk Upload ("Photos" Button)
Allows uploading multiple photos containing QR codes from the device's camera roll or local files.
- Triggered via an invisible file input (`<input type="file" multiple accept="image/*">`) wrapped by the **"Photos"** button in the header card.
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



