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

**Files**: `src/components/ProtectedRoute.jsx`, `src/pages/CompleteProfile.jsx`

All routes except `/login` are wrapped in `<ProtectedRoute>`. This component:
1. Waits for `loading = false` before rendering anything.
2. If `session = null`, silently redirects to `/login`.
3. Otherwise renders `<SidebarLayout>` with `<Outlet/>` for page content.

### Onboarding (`/complete-profile`)
When a new user accepts a Supabase email invite, they land on `/complete-profile`. This page:
1. Checks `roster` for an existing row where `user_id = auth.uid()`.
2. If found, pre-fills `first_name` and `last_initial`.
3. Allows the user to set or update their display name and password.
4. On submit, writes their name to the `roster` table and sets `troop_users.onboarding_completed = true`.

**Important**: The `roster` table has an RLS policy (`"Users can update their own roster entry"`) that allows users to update their own row even without a `troop_admin` role. This is what makes self-onboarding possible.

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

## 5. Design System & Theming

**Files**: `src/styles/global.css`, `src/hooks/useTheme.js`, `src/components/ThemeToggle.jsx`

- All colors, spacing, and visual tokens are CSS custom properties defined in `global.css`.
- Light theme: `:root { --bg-primary: ...; --text-primary: ...; }`.
- Dark theme: `.dark { --bg-primary: ...; --text-primary: ...; }`.
- `useTheme` hook reads OS preference via `prefers-color-scheme` on first load, then persists the user's explicit choice in `localStorage` under `tlc-theme`.
- The `.dark` class is toggled on the `<html>` element. No component uses hardcoded colors.
- This design system is shared with the `jerome-portfolio` project for visual consistency.

---

## 6. Error Handling Security

All pages follow this security pattern for Supabase errors:

```js
// In production: generic message shown to user
setError('Something went wrong. Please try again.');
// Always: log the real error to console for debugging
console.error('Supabase error:', error.message);
```

The `supabaseClient.js` singleton does not expose the Supabase URL or anon key in error output in production builds.

---

## 7. SPA Routing for Cloudflare Pages

`HashRouter` is used instead of `BrowserRouter` because Cloudflare Pages serves from a CDN. Without hash routing, direct navigation to `/#/dashboard` would return the React app's `index.html` correctly without needing server-side redirects. A `public/_redirects` file (`/* /index.html 200`) is also in place as a fallback for any path-based routing edge cases.

---

## 8. Scanner Manual Entry & Photo Scan

**File**: `src/pages/Scanner.jsx`

The Scanner UI contains features to augment standard QR scanning alongside the live-camera flow:

### Manual Entry Modal
Allows users to add attendance for someone who forgot their badge or is a new guest.
- Displayed via `Modal` component controlled by `isManualEntryOpen` state.
- **Existing Member**: Selects an existing roster member (where `attendance` does not already contain a scan for that `roster_id`), inserting a `scans` row immediately.
- **New Member/Guest**: Performs a `supabase.from('roster').insert()` to create the member record, retrieves the newly generated `id`, updates local roster state, and then records the scan.

### Photo Scan / Bulk Upload (`handleBulkPhotos` → `scanFile`)
Allows uploading multiple photos containing QR codes from the device's camera roll or local files.
- Triggered via an invisible file input (`<input type="file" multiple accept="image/*">`) wrapped by the "Photo Mode" button.
- Processed sequentially via `handleBulkPhotos`: for each selected file, an instance of `Html5Qrcode` is created (or reused) and `html5Qrcode.scanFile(file, true)` is invoked to decode the QR code payload without activating camera video feeds.
- Extracted payloads are passed directly into `handleScan` / `processScanPayload`, triggering the exact same validation, lookup, offline queueing, and state update pipeline as live scanning.

---

## 9. Reusable `DataTable` Component

**File**: `src/components/common/DataTable.jsx`

A fully-featured, user-configurable standard HTML table component used for simple tabular views or secondary data lists. (Primary management screens like Events and Scanner use the Pattern 07 responsive grid table architecture). Its state is persisted to `localStorage` per-user, per-table.

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

## 10. Session Purge Threshold & Warning Banner

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


