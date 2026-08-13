# UI/UX Redesign Brief v4 — TLC Attendance

**Status:** Pre-release. Supersedes v3 now that the full architecture doc set (frontend patterns, Chrome Extension, corrected schema/roles) is available.
**Audience for this doc:** AI coding agent (Antigravity or similar) executing the redesign.

---

## 1. Corrections from v3 — read this first

Two things v3 got wrong, now resolved by the docs:

1. **Role names.** The roles are **not** `member`/`admin`/`billing_admin` as v3 assumed — they were renamed in migration 003 and 017. The real `troop_role` enum is **`badge_scanner`, `roster_manager`, `troop_admin`**, plus a separate platform-level `global_admin` (via the `global_admins` table, not a troop role — bypasses all troop-scoped RLS). Every reference to "member" or "admin" role-gating in this document and in the codebase should use the real names. See Section 3 for the corrected role table.
2. **Two things flagged as "missing" in v3 are not missing — they're deliberate, already-documented decisions:**
   - **Approval Queue:** `04_scan_lifecycle.md` states explicitly there is *no* dedicated per-scan approval screen by design — "a deliberate MVP-1 simplification." Approval happens in bulk via "End Session" (sets `ended_at`, batch-updates all `pending` scans to `approved`). This is not a gap to fill; it's the intended MVP-1 pattern. A future per-scan review UI is noted as a possible later addition, not part of this pass.
   - **CSV Import:** Fully implemented in `RosterList.jsx` (not one of the files originally shared — only the `Roster.jsx` wrapper was). It has a real spec: maps `Last Name`/`Nickname`/`First Name`/`Member Number`, title-cases names, applies a PII guardrail (ignores every other CSV column), and upserts on `(troop_id, member_id)` with `ignoreDuplicates: true`. **Preserve this logic exactly** — it's not being redesigned, only restyled if it's touched at all.

---

## 2. Resolved Open Questions (from product owner)

- **Dashboard's role:** confirmed — `badge_scanner` users see **only** the Scanner page. No lightweight stats view needed for them anywhere. Dashboard is purely `roster_manager`/`troop_admin`/`global_admin` territory.
- **PWA/offline conversion:** confirmed **out of scope** for this pass. The existing manual offline queue (localStorage + CSV/JSON export) is sufficient for now; a full installable PWA with background sync is a later project.
- **DataTable state scope:** confirmed **per-user** (from the previous round) — each leader has their own phone/login, no shared-device design needed.

---

## 3. Roles — corrected table

| Role | Landing | Sees | Does NOT see |
|:---|:---|:---|:---|
| `badge_scanner` | **Scanner page — nothing else.** | Scanner, current session's attendance log | Dashboard, Roster, Sessions, Billing, user management, approval/sync actions, roster delete |
| `roster_manager` | Troop Dashboard | Everything above + full roster CRUD (incl. CSV import), Sessions history, End/Reenable/Delete sessions, approve via End Session, Chrome Extension sync, invite/promote/remove users | Billing/Stripe, troop metadata (city/state/troop number) |
| `troop_admin` | Troop Dashboard (admin view + billing) | Everything `roster_manager` sees + troop metadata editing, Stripe billing portal | Nothing hidden — full troop access |
| `global_admin` | N/A — platform-owner bypass, not a normal login persona | All troops via `TroopContext`'s `isGlobalAdmin` flag (troop switcher shows every troop, not just memberships) | N/A |

Two parallel role systems exist and matter for Roster.jsx specifically: `troop_users.role` (drives RLS/access) vs. `roster.role` (labels a roster *row* as `trailman`, `troop_admin`, `roster_manager`, or `badge_scanner` — youth vs. leader distinction within the same table). The Roster DataTable needs role-aware columns: `email` and `user_id`-linked fields are only meaningful for leader rows, not youth rows — don't show empty `email` cells for every trailman.

**Route/access matrix (from `App.jsx`, confirmed in docs):**

| Route | Page | Who should actually land here |
|:---|:---|:---|
| `/login` | Login.jsx | Public |
| `/complete-profile` | CompleteProfile.jsx | Any authenticated user, post-invite |
| `/dashboard` | Dashboard.jsx | `roster_manager` / `troop_admin` / `global_admin` only |
| `/roster` | Roster.jsx | `roster_manager` / `troop_admin` / `global_admin` only |
| `/sessions` | Sessions.jsx | `roster_manager` / `troop_admin` / `global_admin` only |
| `/scanner` | Scanner.jsx | **Everyone** — this is `badge_scanner`'s only destination |
| `/billing` | Billing.jsx | `troop_admin` / `global_admin` only |

Currently all routes are behind one generic `<ProtectedRoute>` with no role branching. This is the concrete implementation target for Section 5, item 3 (role-based routing).

---

## 4. What Already Exists (don't rebuild this)

- **A full token system in `global.css`**: light/dark theme values, spacing scale (`--spacing-xs` → `--spacing-2xl`), radius scale, semantic colors (`--color-primary: #0284c7`/`#60a5fa` dark, `--color-success: #22c55e`, `--color-error: #ef4444`, `--color-warning: #f59e0b`). Docs explicitly call this "the single source of truth... no hardcoded colors anywhere" — current drift is a deviation from the app's own spec, not a stylistic nitpick.
- **Theme toggle** (`useTheme.js`, OS-preference default, persisted to `localStorage['tlc-theme']`), `.dark` class swap.
- **`SidebarLayout.jsx`** is the actual app shell: sidebar nav + header with troop switcher dropdown + `ThemeToggle`, rendering `<Outlet/>`. The responsive sidebar-to-drawer CSS already exists in `global.css` (`.sidebar`, `.hamburger-btn`, `.nav-backdrop`, 767px breakpoint) — confirm `SidebarLayout.jsx` actually uses these classes and filter its nav items by role (Section 3).
- **`TroopContext.jsx`** drives every page's `selectedTroopId`; the troop switcher dropdown in `SidebarLayout.jsx`'s header is the "Active Troop" `<select>` seen in the screenshot — per the table-first preference, becomes a table/list picker, not a `<select>`.
- **`SessionSelector.jsx`** is explicitly documented as "Dropdown for selecting or creating a session before scanning" — confirmed conversion target for the DataTable component.
- **Modal system exists** (`.app-modal-overlay/-content/-title/-body`) — Scanner's unknown-member modal and Sessions' attendee modal both bypass it with ad hoc inline overlays.
- **`useScanLogic.js`** encapsulates the whole scan pipeline: 3-second per-badge cooldown (`lastScanRef`), `tlc_id`→`member_id` lookup priority, `tlc_id` backfill, unknown-member handoff to the modal, and the `pending`-status insert. **Do not touch this logic** — visual pass only.
- **CSV import** — see Section 1, item 2. Fully implemented, preserve as-is.
- **Chrome Extension** (`extension/`) is a separate Manifest V3 build (popup login, background service worker, content script DOM injection into `traillifeconnect.com`). **Out of scope for this brief** — it's a different codebase with its own tiny popup UI. Only relevant here because `tlc_id` capture in the main app is what makes the extension's DOM selector (`#${tlcId}-${eventId}-attended`) work at all — don't let any Scanner redesign risk that field capture.
- **Auth loading states are already handled correctly**: `session` is `undefined` (loading) → `null` (logged out) → `Session` object (logged in), gated by `ProtectedRoute` and shown via `AppSpinner.jsx`. No redesign needed here, just confirm any new role-routing logic (Section 5, item 3) respects this three-state pattern rather than branching on a simple boolean.

---

## 5. The Actual Visual/Structural/Content Gap

- Hardcoded hex colors drifting from real tokens (`#eab308` vs. actual `--color-warning: #f59e0b`; also `#fff3cd`/`#856404`, `#555`/`#333`, `red`, `#d4edda`/`#155724`).
- Hardcoded spacing instead of `var(--spacing-*)`.
- No glassmorphic card treatment outside Login/CompleteProfile.
- Ad hoc modal styling instead of `.app-modal-*`.
- UI only shows session-level sync state, not the per-scan `pending → approved → complete` lifecycle.
- No role-based routing — everyone gets the same `<ProtectedRoute>` treatment regardless of `badge_scanner` vs. `roster_manager`/`troop_admin`.
- **Content bug, not just a visual one:** Dashboard's warning banner reads "Data will be automatically purged in X days" for any unsynced session, using a 30-day soft countdown. But per `04_scan_lifecycle.md`, **scans for sessions that have never been synced are not purged automatically at all** — the real 14-day hard purge only starts counting *after* `synced_at` is set. As written, the banner tells leaders/admins something will be auto-deleted when it won't be. This should be corrected as part of the redesign, not just restyled: the warning should instead communicate "this session hasn't been synced yet" without implying an automatic deletion deadline that doesn't apply to it.

---

## 6. Primary User & Context of Use, by Role

- **`badge_scanner` (highest priority — the entire outdoor use case):** Volunteer leaders, outdoors, one-handed, bright sun/glare, spotty signal, scanning 10-40 kids quickly, own phone. Their entire app experience is the Scanner page — no nav, no dashboard, no distraction.
- **`roster_manager` / `troop_admin`:** Indoors/at a desk more often — roster management, session review, running the Chrome Extension. Lower time-pressure, conventional desktop-friendly patterns are fine.

---

## 7. Design System Tasks (do this first, before touching individual screens)

1. **Fix the color drift.** Swap every hardcoded hex for the matching `var(--color-*)`, using `color-mix()` (already used in Login.css) for tinted backgrounds.
2. **Formalize the glass-card component**, applied across Dashboard, Scanner's status bar, Sessions, Roster, Billing.
3. **Implement role-based routing.** `badge_scanner` → Scanner only, no sidebar/dashboard access at all. `roster_manager`/`troop_admin`/`global_admin` → full nav per the route matrix in Section 3. This is likely the single highest-leverage change in the whole redesign — bigger than any visual polish.
4. **Verify the existing responsive sidebar is used correctly** in `SidebarLayout.jsx` and that its nav items are filtered by role rather than shown-then-disabled.
5. **Standardize buttons**: add missing secondary/neutral and destructive (`--color-error`-based) variants alongside the existing `.btn-primary` (blue) and `.btn-action` (should reference `--color-success`, not repeat its hex).
6. **Adopt `.app-modal-*`** for Scanner's unknown-member modal and Sessions' attendee modal.
7. **Replace `alert()`/`window.confirm()`** with styled toasts and a confirm modal.
8. **Build one reusable DataTable component** (sort, per-column filter, drag-to-reorder columns, show/hide columns, reset-to-default, **per-user persisted state**). Replaces the troop switcher dropdown, `SessionSelector`, and Sessions.jsx's plain table. Tables stay tables at every screen size — no card-collapse on mobile.
9. **Add a scan-status badge** reflecting the real `pending`/`approved`/`complete` lifecycle wherever scans are listed — not just session-level sync state.
10. **Fix the Dashboard warning banner copy** (Section 5) alongside its visual/token rework — this is a factual-accuracy fix, not just styling.

---

## 8. Screen-by-Screen Notes

### 8.1 Login.jsx / CompleteProfile.jsx
Reference standard, minor polish only (placeholder logo, hardcoded success/error colors in CompleteProfile).

### 8.2 Scanner.jsx — `badge_scanner`'s entire app, highest priority
- Keep all existing logic (camera lifecycle, `useScanLogic`, sound, offline queue, QR parsing). Visual/layout pass only.
- No sidebar/nav chrome for `badge_scanner` users — this screen effectively *is* the app for them.
- Control button row needs a bottom-anchored, large-target layout for one-handed use.
- Success/warning overlays should reference `--color-success`/`--color-warning` via `color-mix()`.
- Attendance table reachable without scrolling past the viewfinder (collapsible panel/swipe-up sheet); add the scan-status badge (item 9).
- Unknown-member modal: adopt `.app-modal-*`, confirm single-column mobile stacking.
- "End Session" (visible to `roster_manager`/`troop_admin` when they use Scanner too) gets the new destructive button variant and a confirm modal, kept visible rather than hidden in a menu.
- `SessionSelector` becomes a DataTable instance, not a dropdown.

### 8.3 Dashboard.jsx — `roster_manager`/`troop_admin`/`global_admin` only
- Wrap the overview panel in the glass-card component.
- **Fix the warning banner's copy and token usage together** (Section 5/7 item 10) — this is the one place a pure visual restyle would leave a factual error in place if not addressed explicitly.
- No Approval Queue to build here (Section 1) — the existing bulk End-Session-approves pattern stays as-is.
- Troop switcher becomes a table/list picker.

### 8.4 Sessions.jsx — `roster_manager`/`troop_admin`/`global_admin` only
- Upgrade to the shared DataTable (sort, filter, column show/hide/reorder, reset).
- Status badges extended to show per-scan lifecycle when a session is expanded, not just session-level sync status.
- Row actions (Reset Sync/Reenable/End/Delete) stay as visible inline buttons, never a dropdown.
- Attendee modal: adopt `.app-modal-*`, otherwise structurally solid.

### 8.5 Roster.jsx — `roster_manager`/`troop_admin`/`global_admin` only
- CSV import already exists in `RosterList.jsx` — preserve exactly, just apply tokens/glass-card to its surrounding UI if touched.
- Roster DataTable needs role-aware columns (Section 3) — don't show leader-only fields (`email`) as empty for every youth row.
- Not time-critical, no one-handed constraint.

### 8.6 Billing.jsx — `troop_admin`/`global_admin` only
Still a placeholder. Apply tokens for consistency; confirm route-gating hides it from `badge_scanner`/`roster_manager`.

---

## 9. Explicit Priority Order

1. **Design system pass** (Section 7).
2. **Role-based routing** (Section 7, item 3) — highest-leverage single change.
3. **Scanner.jsx** — `badge_scanner`'s entire experience.
4. **Dashboard.jsx** — token fixes + the warning-copy correction.
5. **Sessions.jsx**.
6. **Roster.jsx / Billing.jsx** — lowest priority.

---

## 10. Explicit Constraints

- No Trail Life / AHG branding, logos, or trademarked visual identity.
- Preserve existing scan logic, offline queue, CSV import, RLS-scoped queries, and the QR payload contract exactly. This is a UI/visual/layout/routing/copy redesign, not a functional rewrite.
- Chrome Extension (`extension/`) is out of scope entirely.
- PWA/offline conversion is out of scope for this pass (confirmed by product owner).
- Approval Queue is intentionally not being built (confirmed deliberate MVP-1 design, not a gap).

---

## 11. Remaining Open Questions

None outstanding — all prior open questions (Approval Queue scope, CSV import status, Dashboard's role for `badge_scanner`, PWA scope, DataTable state scope) are now resolved per Sections 1–2. Flag anything new that surfaces once the agent is in the actual codebase (e.g., `SidebarLayout.jsx` internals weren't directly reviewed, only referenced in docs).

---

## 12. Concerns and Things Requiring Attention (carry-forward for the coding agent)

Consolidated from the whole review — things worth explicit attention rather than assuming the agent will infer them from the sections above.

### Scope discipline
1. **This is a styling/layout/routing/copy pass, not a functional rewrite.** The agent should not refactor `useScanLogic.js`, the CSV import pipeline, RLS-scoped Supabase queries, or the QR payload parsing contract. If a UI change seems to require touching one of these (e.g., adding the scan-status badge), the change should be additive/read-only against that logic, not a rewrite of it.
2. **Role-based routing (Section 7, item 3) is the one item in this brief that's architectural, not purely visual.** It touches auth/routing logic, not just CSS. Treat it with the same care as a functional change — test that `badge_scanner` truly cannot reach `/dashboard`, `/roster`, `/sessions`, `/billing` (both via nav *and* direct URL, since `HashRouter` makes those routes directly typeable), not just that the nav links are hidden.
3. **DataTable scope risk:** sort + filter + drag-reorder + show/hide columns + reset-to-default + per-user persistence is a real component, not a quick wrapper around `<table>`. Worth having the agent build and validate it once (e.g., on Sessions.jsx) before propagating it to the troop switcher, `SessionSelector`, and Roster — don't let it balloon into a mini design-system project that stalls the rest of the redesign.

### Things described in docs but not directly reviewed
4. **`RosterList.jsx`, `SidebarLayout.jsx`, `TroopContext.jsx`, `InviteUser.jsx`, and `ThemeToggle.jsx` were never actually uploaded or read** — everything said about them in this brief (CSV import behavior, sidebar/drawer wiring, troop-switcher dropdown) comes from the architecture docs' descriptions, not from inspecting the code directly. Treat those descriptions as reliable but unverified — the agent should confirm actual behavior against the real files before assuming the brief's characterization is 100% accurate, especially for CSV import (Section 1, item 2), which the brief says to preserve exactly but was never directly inspected.

### Fragile dependencies to protect
5. **`tlc_id` capture must not break.** The Chrome Extension's entire sync mechanism depends on `roster.tlc_id` being captured and backfilled correctly during scanning (`#${tlcId}-${eventId}-attended` DOM selector). Any Scanner.jsx layout change must preserve this data flow exactly — it's invisible in the UI but load-bearing for a separate codebase (`extension/`) that this redesign doesn't touch.
6. **The 3-second scan cooldown and the `UNIQUE(session_id, roster_id)` DB constraint are the actual duplicate-prevention mechanism** — any UI feedback changes (success/duplicate overlays) should reflect this timing accurately rather than inventing new debounce logic.

### Corrections likely to be missed if the agent works section-by-section
7. **The Dashboard warning banner is a content bug, not just an unstyled element** (Section 5/7 item 10) — easy to fix the colors/tokens and leave the misleading "automatically purged" copy in place if the agent treats this as a pure visual task.
8. **Role name migration:** old names (`member`, `admin`) may still appear in comments, variable names, or stale code paths even though the enum itself was renamed to `badge_scanner`/`roster_manager`/`troop_admin` in migration 017. Worth a repo-wide search for the old names to catch anything the docs didn't mention.
9. **Roster's dual role systems** (`troop_users.role` for access control vs. `roster.role` for youth/leader labeling) are easy to conflate. The DataTable column logic needs to key off the right one depending on whether it's controlling access or just display.

### Sequencing risk
10. **Don't let the DataTable and role-routing work block each other.** Both are substantial and both touch Section 7's top priorities. If the agent's workflow processes the priority list strictly in order (Section 9), confirm role-routing (item 2) doesn't get stuck waiting on the DataTable (item 8) or vice versa — they're independent enough to parallelize if the agent's tooling allows it.
