# UI Redesign Action Plan

Reference for planning and executing: `C:\Users\Jerom\My Apps\ai_skills\01.creating_new_features.md`
Architecture docs: `C:\Users\Jerom\My Apps\tlc_attendance_saas\docs\architecture`
  - Review these for the detailed planning
  - Maintain these as we go

## 1. Confirming Requirements

### Rephrased Request
You want to completely overhaul the UI/UX of the TLC Attendance app to match a new glassmorphic design system and the provided React prototype. The primary goal is to elevate the visual aesthetics and implement role-based routing (e.g., restricting `badge_scanner` users to just the Scanner screen). We must strictly maintain all existing functionality, backend queries, and background processes (like the Chrome Extension hooks and `useScanLogic`). We will treat the app's current functionality as the source of truth—meaning any existing buttons or features not in the mockup must be retained and styled to fit the new design, and any new mockup features not present in the app will need clarification before being implemented.

### Edge Cases to Handle
- **Role Permissions & Direct Navigation**: Ensuring `badge_scanner` users cannot bypass routing by manually typing `/dashboard` or `/sessions` in the URL.
- **DOM Stability for Chrome Extension**: Preserving exact DOM ID structures (like `#${tlcId}-${eventId}-attended`) relied upon by the separate Chrome Extension codebase.
- **Offline States**: Keeping the offline scan queue functionality perfectly intact within the new Scanner layout.
- **Data Persistence**: Ensuring DataTable state (column visibility/order) persists correctly per user in `localStorage`.
- **Data Accuracy in Warnings**: Fixing the Dashboard warning banner to ensure it does not inaccurately claim an unsynced session will be auto-purged if it hasn't synced yet.
- **Theme Transitions**: Ensuring smooth transitions between light and dark modes without harsh flashes, using `var(--muted)` for empty states like the camera viewfinder.


## 2. Overall Status

| Phase | Description | Status | Model | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Design System & Global Styles | Complete | Gemini 3.6 Flash (Low) | None |
| 2 | Role-Based Routing & Contexts | Complete | Gemini 3.1 Pro (Low) | None |
| 3 | Reusable DataTable Component | Pending | Gemini 3.1 Pro (High) | Phase 1 |
| 4 | Scanner Screen Redesign | Complete | Gemini 3.1 Pro (High) | Phase 1, 2 |
| 5 | Dashboard & Sessions Polish | Pending | Gemini 3.1 Pro (High) | Phase 1, 3 |
| 6 | Roster & Billing Polish | Pending | Gemini 3.1 Pro (Low) | Phase 1, 3 |

## 3. Phases

### Phase 1: Design System & Global Styles
- **File Changes**: 
  - `Modify` `src/global.css` - Update tokens, `.dark` mode, and utility classes.
  - `Modify` `src/components/common/Button.jsx` (if exists) - Add primary/destructive variants.
  - `Modify` `src/components/common/Modal.jsx` (if exists) - Adopt `.app-modal-*` styles.
- **Key Pattern**: Standard CSS variables with `.dark` class overrides. Use `color-mix()` for tinted backgrounds as specified.
- **Recommended Model**: Gemini 3.6 Flash (Low) - *Simple mechanical task of CSS variable replacement and utility class creation.*
- **Manual Verification**: Run the app locally, toggle light/dark mode, and confirm colors update correctly across standard components.

### Phase 2: Role-Based Routing & Global Components
- **File Changes**:
  - `Modify` `src/App.jsx` - Update routing logic and whitelist `scanner`/`badge_scanner` roles.
  - `Modify` `src/components/SidebarLayout.jsx` - Filter nav by role and implement the Troop Switcher as a custom styled dropdown in the header.
  - `Modify` `src/components/ProtectedRoute.jsx` - Support flexible matching for admin/leader role variations (`troop_admin`, `global_admin`, `billing_admin`, `adult_leader`, `owner`) and fallback paths.
  - `New` `supabase/migrations/008_complete_onboarding_rpc.sql` - `complete_user_onboarding()` RPC function for non-admin onboarding under RLS.
  - `Modify` `src/pages/CompleteProfile.jsx` - Execute `complete_user_onboarding` RPC on submit.
- **Key Pattern**: React Router v6 `<Route element={<ProtectedRoute allowedRoles={['...']} />}>`. Flexible role matching helper (`isAdminOrLeader`). Custom styling for dropdown replacing standard `<select>`.
- **Recommended Model**: Gemini 3.1 Pro (Low) - *Routine logical integration of access control into existing routes.*
- **Manual Verification**: Login as a `badge_scanner` and attempt to navigate to `/dashboard` via URL; verify redirection back to `/scanner`. Verify Troop Switcher is a custom dropdown in the header.

### Phase 3: Reusable DataTable Component
- **File Changes**:
  - `New` `src/components/DataTable.jsx`
- **Key Pattern**: Component state for sorting/filtering, HTML5 drag-and-drop for reordering, `useEffect` for persistence to `localStorage`.
- **Recommended Model**: Gemini 3.1 Pro (High) - *Complex component logic requiring state management and generic data handling.*
- **Manual Verification**: Render a dummy table, reorder columns, refresh the page, and verify column order is preserved.

### Phase 4: Scanner Screen Redesign

> **Risk Level: HIGH** — This is `badge_scanner`'s *entire app experience*. Business logic (`useScanLogic`, offline queue, QR camera lifecycle, DOM hooks for the Chrome Extension) must not change — this is a layout/visual/token pass only.

#### 4.1 — Pre-Implementation Checklist (Read-Only Research)

Before writing a single line of code, verify these facts against the live files:

- [ ] Confirm `useScanLogic.js` signature: `useScanLogic(troopId, sessionId, user, roster, setRoster)` returns `{ handleScan }`. Do **not** change this hook.
- [ ] Confirm `qrEngineRef.current.getState()` values: `2` = SCANNING, `3` = PAUSED — the camera lifecycle depends on these exact magic numbers.
- [ ] Confirm `html5-qrcode` mounts into a `<div id="qr-reader">` — **this DOM ID must remain unchanged**.
- [ ] Confirm the Chrome Extension DOM selector pattern is `#${tlcId}-${eventId}-attended` — verify that no existing JSX generates these IDs in `Scanner.jsx` today (it likely does not; they are injected by the extension itself into `traillifeconnect.com`, not the app). If the app *does* render any elements with that ID pattern, mark them as **DO NOT RENAME**.
- [ ] Confirm all `global.css` tokens to use: `--color-success`, `--color-warning`, `--color-error`, `--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow`, `--spacing-*`, `--radius-*`, `--transition-*`, `--border-color`, `--bg-primary`, `--bg-secondary`, `--bg-elevated`, `--muted`.
- [ ] Note the `isAdminOrLeader` role-check pattern from Phase 2 (wherever it was defined — a helper or inline check) and use that same pattern consistently in Phase 4 so role logic is DRY.

---

#### 4.2 — Layout Architecture

The screen has two major states:

**State A — No Session Selected (Session Picker):**
```
┌──────────────────────────────────┐
│ Header: "Attendance Scanner"  [Theme] [← Dashboard*]
│                                  │
│  glass-card: SessionSelector     │  (*admin roles only)
│  (DataTable — from Phase 3)      │
└──────────────────────────────────┘
```

**State B — Session Active (Scanning View):**
```
┌──────────────────────────────────┐
│ TOP STATUS BAR (glass-card)      │ ← session name, sync badge, End Session btn, Change btn
├──────────────────────────────────┤
│                                  │
│   CAMERA VIEWFINDER (flex: 1)    │ ← #qr-reader stays, success/warning overlays preserved
│   [Session Ended placeholder]    │
│                                  │
├──────────────────────────────────┤ ← collapsible strip (click to expand/collapse)
│ ▼ Recent Scans [badge: 12]  [✕ Remove N] │
├──────────────────────────────────┤
│   ATTENDANCE TABLE (scrollable)  │ ← grid-template-rows animation
│   (only visible when expanded)   │
├──────────────────────────────────┤
│  BOTTOM ACTION BAR (locked)      │ ← Start/Stop | Photo | Manual Entry
└──────────────────────────────────┘
```

**Key layout CSS targets (all set on the outer wrapper):**
```css
/* Outer page wrapper — do not change height:100dvh / overflow:hidden */
height: 100dvh;
display: flex;
flex-direction: column;
overflow: hidden;
position: relative;
```

---

#### 4.3 — Sub-Tasks

##### 4.3.1 — Session Picker Screen (State A)

**File: `src/pages/Scanner.jsx`** (lines ~469–487 in current file)

Changes:
- Wrap the entire picker `<div>` in `className="glass-card"` with `var(--spacing-lg)` padding and `maxWidth: 800px` centered.
- Header (`<h1>Attendance Scanner</h1>`) uses `className="app-title"`.
- "← Back to Dashboard" link: replace the inline `color` style with `className="btn btn-secondary"` styled small. Keep the admin-role gate (`isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin'`) — or refactor to use the `isAdminOrLeader` helper from Phase 2.
- `<ThemeToggle />` stays in the header.
- `<SessionSelector>` is already converted to DataTable in Phase 3 — no further changes needed here, just confirm it renders correctly inside the glass-card wrapper.
- **No-troop guard** (current `if (!troopId)` return): style the fallback `<div>` as a glass-card with a proper empty-state message and icon rather than raw text.

##### 4.3.2 — Top Status Bar (State B header)

**Current element:** `<div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-primary)', ... }}>` (~lines 491–509)

Changes:
- Apply `className="glass-card"` — remove all `background`, `border-bottom`, `zIndex` inline styles that duplicate what `.glass-card` provides.
- Retain `position: relative; z-index: 10` to sit above the viewfinder.
- **Session name `<h2>`**: keep `fontSize: '1.2rem'` but move to `className` or `style` using `var(--font-display)` for the display font. Remove margin with `margin: 0`.
- **Status line** `(Active / Ended • Synced / Unsynced)`:
  - Replace inline `color:` strings with badge components:
    - `<span className="badge badge-success">Active</span>` / `<span className="badge badge-error">Ended</span>`
    - `<span className="badge badge-warning">Unsynced</span>` / `<span className="badge badge-neutral">Synced</span>`
- **Offline Queue badge** `(attendance.filter(...).length)`:
  - Keep existing `className="badge badge-pending"` — confirm badge text is clear (add a tooltip `title="Offline Queue"` — already present, keep it).
- **End Session button**: keep `className="btn btn-destructive"` — verify it uses the token `var(--color-destructive)` and NOT a hardcoded hex. Confirm `padding` / `fontSize` use token values.
- **Change button**: keep `className="btn btn-secondary"` — same token check.
- **Admin role gate** for End Session: use the `isAdminOrLeader` helper or exact same condition — do not alter the logic.

##### 4.3.3 — Camera Viewfinder Area

**Current element:** `<div style={{ flex: isTableVisible ? '0 0 45%' : '1', ... }}>` (~lines 512–549)

Changes:
- Replace the `background: '#000'` inline style with `background: 'var(--muted)'` so the empty viewfinder area respects the theme in both light and dark mode (as specified in the edge-case doc under "Theme Transitions").
- Keep `position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden` — these are load-bearing for the QR camera layout.
- The `flex` value change when `isTableVisible` toggles stays exactly as-is — this drives the camera expand/collapse animation.
- **`<div id="qr-reader">`**: **DO NOT RENAME OR REMOVE**. Only allowable change: confirm `style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}` still applies (or equivalent). No class additions to this element.
- **Success overlay** (`showCheckmark`):
  - Replace `backgroundColor: 'rgba(34, 197, 94, 0.1)'` → `backgroundColor: 'color-mix(in srgb, var(--color-success) 10%, transparent)'`
  - Remove the hardcoded `white` background on the inner circle — replace with `var(--bg-secondary)` so it isn't jarring in dark mode.
  - SVG `stroke="var(--color-success)"` already uses token — keep as-is.
- **Warning overlay** (`showWarning`):
  - Replace `backgroundColor: 'rgba(234, 179, 8, 0.1)'` → `backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)'`
  - Inner circle background: `var(--bg-secondary)`.
  - SVG `stroke="var(--color-warning)"` — keep as-is.
- **Session Ended state** (inside viewfinder when `session.ended_at`):
  - Replace `color: 'white'` with `color: 'var(--foreground)'` — "white" is hardcoded and wrong in light mode.
  - "Reenable Session" → `className="btn btn-primary"`, remove `style={{ marginTop: '1rem' }}` in favor of `var(--spacing-md)`.
  - "Reset Sync Status" → `className="btn btn-action"`, same spacing fix.

##### 4.3.4 — Collapsible Attendance Panel (Table Area)

**Current elements:** Inline-table header + grid animation wrapper (~lines 551–636)

Changes to the **panel header** (the click-to-toggle strip):
- Replace raw inline background `var(--bg-secondary)` + border with `className="glass-card"` + remove the `cursor: pointer` + `userSelect: none` inline style (move to a dedicated CSS rule or keep inline — either is fine).
- Replace `▼ Collapse` / `▲ Expand` button with a proper icon (`⌄`/`⌃` or an SVG chevron) and `className="btn"` with `background: transparent`.
- **Select All checkbox** (admin-only): Currently missing from the header strip — verify if it exists in the current code. If not, add a `<input type="checkbox" onChange={handleSelectAll}>` to the header row for admin roles.

Changes to the **attendance table rows** (~lines 582–606):
- Replace all `padding: '0.75rem'` inline table `<td>` styles with `className` or keep as-is (acceptable to keep here since these are truly one-off).
- **Scan status badge**: each row currently shows `scan.message` inside a `className={badge badge-*}`. **Add the real lifecycle badge** using `scan.status`:
  - `'success'` and `scan.message === 'Scanned In'` → `badge-success` → display "Scanned In"
  - `'success'` and `scan.message === 'Saved Offline'` → `badge-warning` → display "Saved Offline"
  - `'error'` and `scan.message === 'No QR found in image'` → `badge-error` → display "No QR"
  - Leave the status field value unchanged — this is purely a display mapping, not a logic change.
- Remove any stray hardcoded `color:` values in row cells (check for `color: 'var(--text-secondary)'` which is correct — keep it; remove any hardcoded `#` colors if found).
- **Empty state** `"No people scanned in yet."`:
  - Wrap in a styled empty-state container with centered text and a subtle icon, using `var(--text-secondary)` for color and `var(--spacing-xl)` for padding.

Changes to the **"selected items" action bar** (~lines 629–636):
- Replace `background: 'var(--color-error)'` → use `className` with a tinted background: `background: 'color-mix(in srgb, var(--color-error) 15%, transparent)'`, `border-top: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent)'`, `color: 'var(--color-error)'`.
- The inner "Remove" button: replace the raw inline `style` with `className="btn btn-destructive"` styled small.

##### 4.3.5 — Bottom Action Bar

**Current element:** `<div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-elevated)', borderTop: ..., display: 'grid', gridTemplateColumns: '1fr 1fr', ... }}>` (~lines 614–626)

This is the highest-priority UX area — one-handed, outdoor, large targets.

Changes:
- Replace `background: 'var(--bg-elevated)'` with `className="glass-card"` and remove border-top (it's included in the glass-card border).
- Increase button padding: `padding: 'var(--spacing-lg) var(--spacing-md)'` (from `1rem`) for large tap targets.
- `gridTemplateColumns`: change from `'1fr 1fr'` to `'1fr 1fr 1fr'` to accommodate the new **Manual Entry** button.
- **Start/Stop Scan button**:
  - Keep all existing state-based logic (`qrEngineRef.current?.getState() === 2`).
  - Keep `className={btn ${... ? 'btn-secondary' : 'btn-primary'}}`.
  - Add a camera icon (SVG or emoji `📷`) before the text label.
  - Increase `fontSize: '1rem'` → `'1.1rem'`.
- **Photo Mode button** (the file-input wrapper):
  - Keep the existing `<div style={{ position: 'relative', overflow: 'hidden' }}>` + hidden `<input type="file">` pattern — this is documented in the redesign brief as the correct "scanFile" approach.
  - The inner `<button>` → `className="btn btn-secondary"`, full width, same size as Start/Stop.
  - Add a photo icon (📁 or SVG) before "Photo Mode".
- **NEW: Manual Entry button**:
  - `<button className="btn btn-secondary" onClick={() => setIsManualEntryOpen(true)}>+ Manual Entry</button>`
  - This opens the **Manual Entry Modal** (see 4.3.7 below).
  - **State to add**: `const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);`

##### 4.3.6 — Unknown Member Modal (Adopt `.app-modal-*`)

**Current element:** `<Modal isOpen={!!unknownPayload} ...>` (~lines 642–786)

The `<Modal>` component wrapper is already being used — good. Changes are internal to the modal body:

- Replace all remaining inline `style` hex colors inside the modal body with tokens:
  - `color: 'var(--color-primary)'` (link) — already correct, keep.
  - `backgroundColor: 'var(--bg-secondary)'` on the member-list panel — already correct, keep.
  - `border: '1px solid var(--border-color)'` on the list panel — already correct, keep.
  - `backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent'` — keep.
  - Input `style` inline: `background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px'` — these are already using tokens, keep as-is but normalize to `var(--radius-sm)`.
- Fix `justify: 'space-between'` typo in `Modal.jsx` line 29 → `justifyContent: 'space-between'` (this is a bug in the Modal component discovered during research — fix it here since it affects this modal's header layout).
- **Mobile stacking**: The grid `gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'` already handles responsive stacking — keep as-is, it satisfies the brief's "confirm single-column mobile stacking" requirement.
- The "Link & Save Scan" and "Cancel" buttons are already using `className="btn btn-primary"` and `className="btn btn-secondary"` — keep.
- **Keyboard accessibility**: Confirm the `Escape` key handler in `Modal.jsx` properly resumes the camera (`qrEngineRef.current.resume()`) — it currently fires `onClose`, which does resume. Verify the `onClose` callback passed to this modal instance includes the camera resume and `resolveUnknownRef` cleanup (lines ~644–651 — it does). **No logic changes needed.**

##### 4.3.7 — NEW: Manual Entry Modal

**This is a net-new feature**, confirmed in scope by the redesign brief ("+ Manual Entry: Implement as a new feature (likely a modal) to add a person to the roster/session if they forgot their badge").

**State additions to `Scanner.jsx`:**
```jsx
const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
const [manualEntryFirstName, setManualEntryFirstName] = useState('');
const [manualEntryLastInitial, setManualEntryLastInitial] = useState('');
const [manualEntryRosterId, setManualEntryRosterId] = useState('');
```

**Handler `handleManualEntry`** — mirrors `handleResolveUnknown` but without a `unknownPayload`:
```jsx
const handleManualEntry = async (e) => {
  e.preventDefault();
  // Case 1: selected from roster list
  // Case 2: manual name → insert new roster entry
  // Then: insert scan record with { session_id, roster_id, status: 'pending', scanned_by: user.id }
  // Then: add to attendance state exactly as in handleResolveUnknown
  // Then: close modal + clear state + play success sound
};
```

**The modal JSX** (add after the Unknown Member Modal, before the closing `</div>`):
```jsx
<Modal
  isOpen={isManualEntryOpen}
  onClose={() => { setIsManualEntryOpen(false); setManualEntryFirstName(''); setManualEntryLastInitial(''); setManualEntryRosterId(''); }}
  title="Manual Entry"
>
  {/* Reuse same two-column layout as Unknown Member Modal:
      Left: scrollable list of ALL roster members (not just those without IDs)
      Right: or add new member by name
      Bottom: "Record Attendance" btn-primary + "Cancel" btn-secondary */}
</Modal>
```

**Important distinctions from Unknown Member Modal:**
- The roster picker on the left shows **all** roster members (not just `membersWithoutIds`) — the person forgot their badge, not that they don't exist.
- No `tlcId`/`memberId` payload to backfill — skip the `update roster` logic.
- No camera resume needed (camera was not paused for this flow).
- Selecting an already-scanned member should show an inline warning: "This person is already marked as scanned in." (check attendance state, same dedup logic).

##### 4.3.8 — Admin-Only Controls: Reenable / Reset Sync (Session Ended state)

These buttons are already in the viewfinder's "Session Ended" placeholder. Confirm:
- "Reenable Session" → `className="btn btn-primary"` (already set) — replace `marginTop: '1rem'` → `style={{ marginTop: 'var(--spacing-md)' }}`.
- "Reset Sync Status" → `className="btn btn-action"` (already set) — same spacing fix.
- Admin gate: `(isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin')` — use `isAdminOrLeader` helper if Phase 2 defined one.

---

#### 4.4 — Token Drift Audit (Search and Fix)

Run a search in `Scanner.jsx` for these patterns before finalizing:

| Find | Replace With |
|:---|:---|
| `'#000'` | `'var(--muted)'` (viewfinder bg) |
| `'white'` | `'var(--bg-secondary)'` or `'var(--foreground)'` depending on context |
| `rgba(34, 197, 94, 0.1)` | `color-mix(in srgb, var(--color-success) 10%, transparent)` |
| `rgba(234, 179, 8, 0.1)` | `color-mix(in srgb, var(--color-warning) 10%, transparent)` |
| `rgba(0,0,0,0.2)` (box-shadow) | `var(--glass-shadow)` |
| Any `#` hex color not in a token reference | Replace with matching `var(--color-*)` |
| `marginTop: '1rem'` | `marginTop: 'var(--spacing-md)'` |
| `padding: '1rem'` (buttons) | `padding: 'var(--spacing-lg) var(--spacing-md)'` |
| `fontSize: '0.8rem'` (status bar btns) | `fontSize: '0.8rem'` — keep (below the token scale, intentionally small) |

---

#### 4.5 — CSS-Only Additions Needed in `global.css`

Scanner may need these new utility classes (check if they already exist before adding):

```css
/* Scan viewfinder container */
.scanner-viewfinder {
  background: var(--muted);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: flex var(--transition-normal);
}

/* Scan result overlay (success / warning) */
.scan-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.scan-overlay--success {
  background: color-mix(in srgb, var(--color-success) 10%, transparent);
}
.scan-overlay--warning {
  background: color-mix(in srgb, var(--color-warning) 10%, transparent);
}

/* Bottom action bar */
.scanner-action-bar {
  padding: var(--spacing-md);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border-top: 1px solid var(--glass-border);
  display: grid;
  gap: var(--spacing-md);
}

/* Collapsible attendance panel header */
.scanner-panel-header {
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  user-select: none;
}

/* Scan row empty state */
.scan-empty-state {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--text-secondary);
}
```

---

#### 4.6 — Edge Cases & Constraints

| Scenario | Handling |
|:---|:---|
| **Chrome Extension DOM selector** | `#qr-reader` div ID must not change. The extension injects into `traillifeconnect.com`, not this app — but confirm no IDs in Scanner.jsx match `#${tlcId}-${eventId}-attended`. |
| **`useScanLogic` must not be modified** | All scan pipeline logic stays in the hook. The only Scanner.jsx changes are JSX structure and CSS tokens. |
| **Camera state magic numbers** | `getState() === 2` (SCANNING), `getState() === 3` (PAUSED) — do not change or abstract these. |
| **Offline queue** | `exportOffline()`, `localStorage.getItem('tlc_offline_scans')` — do not touch. The offline badge count in the status bar must still count `attendance.filter(s => s.message === 'Saved Offline').length`. |
| **Dark mode viewfinder** | Replace `background: '#000'` with `var(--muted)` — in dark mode this will be `#1e293b` (slate-800), which is intentionally NOT pitch black, providing a visible border against the dark background. |
| **`badge_scanner` role** | They have no admin role — `isGlobalAdmin` is false, `currentUserRole` is not `troop_admin` or `billing_admin`. Verify: no "End Session", no "Change" to dashboard, no bulk remove checkboxes, no "Reenable" button. The phase 2 routing prevents them accessing other pages. |
| **Manual Entry dedup** | Before inserting a manual scan, check if `attendance.some(a => a.roster_id === targetRosterId)` — show inline error and do not re-insert. |
| **Smooth camera-to-table transition** | The existing `flex: isTableVisible ? '0 0 45%' : '1'` and `grid-template-rows: isTableVisible ? '1fr' : '0fr'` pattern is correct — keep it. Only add `transition: flex var(--transition-normal)` if not already present. |
| **`Modal.jsx` bug** | Line 29 has `justify: 'space-between'` — should be `justifyContent`. Fix this in `Modal.jsx` as part of this phase (it's a quick one-line fix and affects the unknown-member modal header layout). |

---

#### 4.7 — File Changes Summary

| File | Action | Notes |
|:---|:---|:---|
| [`Scanner.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/pages/Scanner.jsx) | `Modify` | Primary file — all layout, token, and new Manual Entry modal |
| [`Modal.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/components/common/Modal.jsx) | `Modify` | One-line fix: `justify` → `justifyContent` (line 29 and 60) |
| [`global.css`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/styles/global.css) | `Modify` | Add scanner-specific utility classes (4.5) only if not already present |

---

#### 4.8 — Recommended Model

**Gemini 3.1 Pro (High Thinking Budget)** — High-risk integration: careful preservation of camera lifecycle, hook contract, and Chrome Extension DOM dependencies alongside a structural JSX rewrite.

---

#### 4.9 — Manual Verification Steps

1. **Happy path — live scan**: Start a session → tap "Start Scan" → scan a valid QR code. Verify:
   - Green success overlay appears (using `color-mix` token, not hardcoded hex).
   - Scan appears in the attendance list with a `badge-success` badge.
   - Camera resumes after 2 seconds automatically.
   - Sound plays.

2. **Duplicate scan**: Scan the same badge within 3 seconds. Verify the 3-second cooldown silently ignores it. Then scan again after 3 seconds — verify the yellow warning overlay appears.

3. **Unknown member**: Scan a badge not in the roster. Verify the Unknown Member Modal opens, camera pauses. Select an existing member → submit → verify scan is recorded and camera resumes. Separately: type a new name → submit → verify new roster entry is created and scan is recorded.

4. **Manual Entry**: Tap "+ Manual Entry" button. Verify the modal opens. Select a roster member → submit → verify scan is recorded. Verify that selecting an already-scanned member shows an inline warning. Close without submitting → verify nothing changes.

5. **Photo mode**: Tap "Photo Mode" → select one or more photos with valid QR codes. Verify each is processed in sequence and results appear in the attendance list.

6. **End Session (admin)**: Login as `troop_admin`. Verify "End Session" button is visible in the status bar. Click it → confirm modal fires (from `useConfirm`) → verify session is marked ended and camera stops.

7. **badge_scanner role**: Login as `badge_scanner`. Verify:
   - No "End Session" button.
   - No "← Back to Dashboard" link.
   - No bulk-remove checkboxes.
   - No "Reenable Session" / "Reset Sync" buttons.

8. **Dark mode**: Toggle dark mode. Verify:
   - Viewfinder background is `var(--muted)` (slate-800), not pitch black.
   - Overlays use `color-mix` tokens (visible against dark bg).
   - Status bar uses glass-card (blurred, semi-transparent).
   - No white flashes or invisible text.

9. **Collapsible panel**: Tap the "Recent Scans" header strip. Verify the table collapses/expands with the `grid-template-rows` CSS animation — no jump cuts.

10. **Chrome Extension DOM**: Confirm (via browser DevTools → Elements) that no element in Scanner.jsx has an ID matching the pattern `*-attended`. This verifies the redesign has not accidentally shadowed the extension's DOM injection target.

---

#### 4.10 — Architecture Doc Update (Upon Completion)

- [x] **`docs/architecture/05_frontend_patterns.md`**: Add documentation for bulk photo upload scanning (`handleBulkPhotos` → `scanFile` pattern) and the Manual Entry modal flow alongside the standard live-camera flow.
- [x] **`ui_redesign_action_plan.md`**: Mark Phase 4 status as `Complete` in the Overall Status table.

### Phase 5: Dashboard & Sessions Polish
- **File Changes**:
  - `Modify` `src/pages/Dashboard.jsx`
  - `Modify` `src/pages/Sessions.jsx`
- **Key Pattern**: Component composition and prop passing to DataTable. Updating text content for accuracy.
- **Recommended Model**: Gemini 3.1 Pro (High) - *Refactoring existing data lists to use the new complex DataTable component and updating visual logic.*
- **Manual Verification**: Load the Dashboard, verify the warning banner copy. Go to Sessions, verify the table uses the new interactive component.

### Phase 6: Roster & Billing Polish
- **File Changes**:
  - `Modify` `src/pages/Roster.jsx`
  - `Modify` `src/pages/Billing.jsx`
- **Key Pattern**: Conditional column rendering in DataTable based on row data (hiding email for youth).
- **Recommended Model**: Gemini 3.1 Pro (Low) - *Straightforward styling and minor logic adjustments.*
- **Manual Verification**: View the roster; verify youth rows do not display email fields, and layout uses glassmorphism.

## 4. Architecture Doc Updates Needed
- [x] **`02_rls_and_auth.md`**: Updated to document `complete_user_onboarding()` RPC function for non-admin onboarding.
- [ ] **`05_frontend_patterns.md`**: Update during Phase 4 to document bulk photo upload scanning (`scanFile`) alongside live camera feed scanning.
- [ ] **`05_frontend_patterns.md`**: Update to reflect `DataTable` component specifications upon completion of Phase 3.
