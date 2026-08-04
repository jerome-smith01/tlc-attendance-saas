# Action Plan: TLC Attendance — MVP-1 (First Troop)

> **Last updated:** 2026-08-03

*Reference: Follows workflow outlined in `C:\Users\Jerom\My Apps\ai_skills\01.creating_new_features.md`*

## Scope of MVP-1

This is a **single-troop deployment** for internal use only (your troop, SC-0110). MVP-1 intentionally excludes:
- Multi-tenancy (no other troops)
- Stripe billing / subscription management
- Demo mode
- Role-based onboarding walkthrough (deferred to a later MVP)

What MVP-1 **does** include:
- A working React SPA hosted at `tlc.goodplusfast.com` (Cloudflare subdomain → Cloudflare Pages)
- Supabase Auth with email/password login
- A single hardcoded troop in the database (SC-0110)
- Role-based permissions (Billing Admin, Admin, Member)
- Roster management with First Name + Last Initial (COPPA mitigation)
- Roster import from Trail Life Connect CSV
- Live QR code scanner with 3-second cooldown
- Session tracking by Event Name + Date
- New Chrome Extension connecting to Supabase instead of Google Apps Script

---

## Hosting Decision

**Subdomain is confirmed: `tlc.goodplusfast.com`**

After reviewing your existing stack, your main site (`goodplusfast.com`) is deployed on **Cloudflare Workers** via `wrangler.toml` with the `@astrojs/cloudflare` adapter. The Bible PWA at `/bible/` is proxied through that same Astro app — it is not a standalone deployment. This means a `/tlc-attendance` path route would need to be built into that existing Astro project, creating tight coupling.

A subdomain is the correct call. But the right deployment target is **Cloudflare Pages**, not Vercel:

| Option | Decision | Reason |
| :--- | :--- | :--- |
| `tlc.goodplusfast.com` → **Cloudflare Pages** | ✅ **Selected** | Consistent with your existing stack. You already know `wrangler`. Free tier is generous. Cloudflare handles HTTPS automatically. Stays in one dashboard. |
| `tlc.goodplusfast.com` → Vercel | ❌ Updated | No reason to introduce a second platform when Cloudflare Pages does the same job and you're already there. |
| `goodplusfast.com/tlc-attendance` (path) | ❌ Not selected | Requires integrating the React SPA into the Astro project, creating deployment coupling. |

**Infrastructure:**
- **Frontend:** React (Vite) SPA → deployed to **Cloudflare Pages**
- **Database & Auth:** **Supabase** (same project you already use for goodplusfast.com)
- **DNS:** Cloudflare custom domain on the Pages project (no CNAME needed — all native)

---

## Tech Stack Decision: React SPA

After discussing the tradeoffs of Flutter, React Native, and React SPA, we've decided to proceed with **React SPA** for MVP-1.

**Why React SPA?**
- Fastest path to a working MVP.
- Familiar web stack (HTML/CSS/JS).
- Excellent live continuous QR scanning via `html5-qrcode` without needing to click a button.
- Deploys instantly to Cloudflare Pages.
- Users can "Add to Home Screen" to get an app icon, which is sufficient for troop leaders right now.

*Note: While it cannot be pushed natively to the iOS App Store without a wrapper, we are prioritizing speed and a seamless web experience for MVP-1 over native app distribution.*

---

## Overall Status

| Phase | Description | Status | Model | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Database & Supabase Schema | Complete | `Claude Opus 4.6 (Thinking)` | None |
| 2 | Frontend Foundation & Auth | Complete | `Gemini 3.1 Pro (High)` | Phase 1 |
| 3 | Dashboard & Roster Management | Pending | `Gemini 3.1 Pro (High)` | Phase 2 |
| 4 | Scanner Implementation | Pending | `Claude Sonnet 4.6 (Thinking)` | Phase 3 |
| 5 | Chrome Extension | Pending | `Gemini 3.1 Pro (High)` | Phase 1, 4 |
| 6 | Cloudflare Pages Deployment | Pending | `Gemini 3.1 Pro (Low)` | Phase 2 |

---

## Decisions Log

| Decision | Choice |
| :--- | :--- |
| COPPA / PII | Store First Name + Last Initial only (e.g., "John S.") |
| Demo Mode | Deferred — not part of MVP-1 |
| Onboarding Walkthrough | Deferred — not part of MVP-1 |
| Billing / Stripe | Deferred — not part of MVP-1 |
| Multi-troop support | Deferred — schema still supports it, but MVP-1 has one troop |
| Auth model | Supabase email/password |
| Roles | Billing Admin, Admin, Member (GroupMe-style) |
| Multi-troop per user | Schema supports it; not exercised in MVP-1 |
| Subscription expiry banner | Deferred — no billing in MVP-1 |
| Session tracking | Event Name + Date combination |
| Scanner UX | Live continuous feed, 3-second cooldown, no tap-to-capture |
| Extension auth | Email/password login in popup; Sync button disabled if not logged in |
| Roster name format | First Name + Last Initial |

---

## CSV Import Specification

**Sample file:** `MVP-1_SC-0110 Members 08-03-2026.csv`

**Columns present in the export (only these 4 are used; all others are ignored to avoid PII ingestion):**

| CSV Column | Maps To | Rule |
| :--- | :--- | :--- |
| `Last Name` | `last_initial` | Take the first character of `Last Name`. Handle quoted names containing commas (e.g., `"Powell, III"` → initial is `P`). |
| `First Name` | `first_name` | Fallback only — used when `Nickname` is blank. |
| `Nickname` | `first_name` | **Primary source.** Use `Nickname` if non-empty AND different from `First Name` (some rows duplicate the formal name as nickname, e.g., "Theodore / Theodore" — treat those as blank). |
| `Member Number` | `member_id` | Direct copy. This is the badge-printed ID (e.g., `2024-977268`). |

**Edge cases the parser must handle:**
1. **Quoted last names with commas** — `"Powell, III"` must parse as a single field; first character `P`.
2. **Nickname = First Name** — treat as no nickname; fall back to `First Name`.
3. **Blank Nickname** — use `First Name`.
4. **Inconsistent capitalization** — e.g., `jaxson` (row 36) should be stored as-is or title-cased (decision: title-case all names on import).
5. **Trailing whitespace / empty last row** — the CSV has a blank line 45; the parser must skip it.

**Parsed output example:**

| first_name | last_initial | member_id |
| :--- | :--- | :--- |
| Beau | B | 2025-700124 |
| Liam | B | 2026-229614 |
| Benji | H | 2024-977268 |
| Theodore | H | 2021-560543 |
| Gwyd | K | 2022-860270 |
| JWPIII | P | 2024-159842 |
| TJ | R | 2025-403079 |

---

## Database Schema (Supabase PostgreSQL)

> Schema is designed to support future multi-tenancy even though MVP-1 only has one troop. RLS is enforced from day one.

### `troops`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Internal only — not exposed in URLs |
| `troop_number` | text | e.g., "SC-0110" |
| `city` | text | e.g., "Spartanburg" |
| `state` | char(2) | e.g., "SC" |
| `stripe_customer_id` | text | Nullable in MVP-1 |
| `subscription_status` | text | Enum: `active`, `past_due`, `canceled`, `unpaid` — nullable in MVP-1 |
| `subscription_ends_at` | timestamptz | Nullable in MVP-1 |

### `troop_users` (Junction — one user can belong to multiple troops)
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID (PK) | |
| `user_id` | UUID | References `auth.users` |
| `troop_id` | UUID | References `troops` |
| `role` | text | Enum: `billing_admin`, `admin`, `member` |
| `onboarding_completed` | boolean | Per-user walkthrough flag (deferred) |

### `roster`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID (PK) | |
| `troop_id` | UUID | References `troops` |
| `first_name` | text | Nickname if available, else First Name |
| `last_initial` | char(1) | First character of Last Name only |
| `member_id` | text | From "Member Number" column in CSV (printed on physical badge) |
| `tlc_id` | text | Embedded in QR code — **NOT** in the CSV export; populated on first scan |

> **TLC ID ↔ Member ID Strategy:** The CSV only gives us `member_id`. The `tlc_id` is a separate value embedded inside the QR code payload. On first scan of a badge, the scanner will read the QR and extract the `tlc_id`. We then attempt to match it to an existing roster entry by `member_id` (which is also present in the QR payload per the existing app's `parseQrPayload` logic: `memberId | tlcId`). If a match is found, we write the `tlc_id` back to that roster row so future scans can match directly by `tlc_id`. If no match is found, the scan is flagged as "Unknown Member" and can be resolved manually by an Admin.

### `sessions`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID (PK) | |
| `troop_id` | UUID | References `troops` |
| `event_name` | text | e.g., "Regular Meeting" |
| `event_date` | date | |

### `scans`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | UUID (PK) | |
| `session_id` | UUID | References `sessions` |
| `roster_id` | UUID | References `roster` |
| `scan_time` | timestamptz | |
| `status` | text | Enum: `Pending`, `Approved`, `Complete` |

---

## Phases

### Phase 1: Database & Supabase Schema

**File Changes:**
| Action | File | Note |
| :--- | :--- | :--- |
| New | `supabase/migrations/001_initial_schema.sql` | Create all 5 tables |
| New | `supabase/migrations/002_rls_policies.sql` | RLS scoped to `auth.uid()` via `troop_users` |
| New | `docs/architecture.md` | Document schema, RLS strategy, and auth flow |

**Key Pattern — RLS enforcement:**
```sql
CREATE POLICY "Member roster access"
ON roster FOR SELECT
USING (
  troop_id IN (
    SELECT troop_id FROM troop_users WHERE user_id = auth.uid()
  )
);
```

**Recommended Model:** `Claude Opus 4.6 (Thinking)`
*Schema design and RLS are the safety-critical foundation; silent misconfiguration here could expose data across troops in future MVPs.*

**Manual Verification Checklist:**
- [ ] All 5 tables visible in Supabase Table Editor
- [ ] Seed one troop (SC-0110) + your user account as `billing_admin`
- [ ] Confirm RLS prevents querying `roster` without a valid session
- [ ] Confirm a logged-in user CAN query their own troop's roster

---

### Phase 2: Frontend Foundation & Auth

**File Changes:**
| Action | File | Note |
| :--- | :--- | :--- |
| New | `frontend/` | New Vite + React project root |
| New | `frontend/src/lib/supabaseClient.js` | Initialize Supabase with env vars |
| New | `frontend/src/App.jsx` | React Router: Login → Dashboard → Scanner |
| New | `frontend/src/pages/Login.jsx` | Email/password auth via Supabase |
| New | `frontend/src/context/AuthContext.jsx` | Global auth session provider |

**Key Pattern — Auth listener:**
```js
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
});
```

**Recommended Model:** `Gemini 3.1 Pro (High)`
*Multi-file SPA scaffolding with routing and auth context requires resolving logical dependencies across several new files simultaneously.*

**Manual Verification Checklist:**
- [ ] `npm run dev` starts without errors
- [ ] Login page loads at `/`
- [ ] Sign in with your email; redirects to Dashboard
- [ ] Refresh the page; session persists (no re-login required)
- [ ] Sign out; redirected back to Login

---

### Phase 3: Dashboard & Roster Management

**File Changes:**
| Action | File | Note |
| :--- | :--- | :--- |
| New | `frontend/src/pages/Dashboard.jsx` | Shows roster, sessions, and active users |
| New | `frontend/src/components/RosterList.jsx` | Display + edit roster members |
| New | `frontend/src/components/InviteUser.jsx` | Admin can invite users by email |
| New | `frontend/src/utils/csvParser.js` | Parse TLC CSV per the spec above |

**CSV Parsing Logic Summary:**
- Use a spec-compliant CSV parser (e.g., `papaparse`) to handle quoted fields correctly
- `first_name` = Nickname if non-empty and not equal to First Name, else First Name; title-case result
- `last_initial` = first character of Last Name (after stripping quotes); uppercase
- `member_id` = Member Number field, direct copy
- Skip blank rows

**Recommended Model:** `Gemini 3.1 Pro (High)`
*Stateful React data management + external CSV parsing requires significant context across multiple files and edge case handling.*

**Manual Verification Checklist:**
- [ ] Dashboard loads and shows "SC-0110"
- [ ] Roster list displays seeded members
- [ ] Add a new member manually (First Name + Last Initial)
- [ ] Import the `MVP-1_SC-0110 Members 08-03-2026.csv`; confirm 43 members are parsed
- [ ] Verify "Benji H", "Gwyd K", "JWPIII P", "TJ R" appear (nickname logic working)
- [ ] Verify "Theodore H" appears only once (deduplicated nickname logic)
- [ ] Invite a second user by email; confirm they receive a Supabase invite email
- [ ] Second user logs in; can only see SC-0110 data

---

### Phase 4: Scanner Implementation

**File Changes:**
| Action | File | Note |
| :--- | :--- | :--- |
| New | `frontend/src/pages/Scanner.jsx` | Live camera feed with `html5-qrcode` |
| New | `frontend/src/hooks/useScanLogic.js` | Cooldown timer + duplicate check + Supabase write |
| New | `frontend/src/components/SessionSelector.jsx` | Pick or create a named session before scanning |

**Key Pattern — cooldown guard:**
```js
const lastScanRef = useRef({});
function handleScan(id) {
  const now = Date.now();
  if (now - (lastScanRef.current[id] ?? 0) < 3000) return; // 3s cooldown
  lastScanRef.current[id] = now;
  // write scan to Supabase...
}
```

**Recommended Model:** `Claude Sonnet 4.6 (Thinking)`
*Camera lifecycle, timing/debounce bugs, and browser permission handling fail silently and require careful reasoning about async edge cases.*

**Manual Verification Checklist:**
- [ ] Scanner page loads and requests camera permission
- [ ] Select or create a session (e.g., "Test Meeting - Aug 3")
- [ ] Scan a valid QR badge; "Success" feedback appears immediately without tapping
- [ ] Hold badge in view for 5+ seconds; no duplicate scan is recorded
- [ ] Scan an unknown badge; "Unknown Member" state is shown clearly
- [ ] Check Supabase `scans` table; row exists with correct `session_id` and `status = Pending`

---

### Phase 5: Chrome Extension

**File Changes:**
| Action | File | Note |
| :--- | :--- | :--- |
| New | `extension/manifest.json` | Manifest V3; targets `traillifeconnect.com` + `tlc.goodplusfast.com` |
| New | `extension/popup.html` | Email/password login UI |
| New | `extension/popup.js` | Supabase auth; stores JWT in `chrome.storage.local` |
| New | `extension/content.js` | Injects Sync button; disabled if no valid JWT found |
| New | `extension/background.js` | Handles Supabase API calls from service worker context |

**Key Pattern — Sync button gating:**
```js
chrome.storage.local.get('supabase_session', ({ supabase_session }) => {
  if (!supabase_session) {
    showError('Please log in via the TLC Attendance extension popup first.');
    return;
  }
  // proceed with sync...
});
```

**Recommended Model:** `Gemini 3.1 Pro (High)`
*Content script isolation, message passing between popup/background/content scripts, and cross-origin Supabase calls involve resolving complex multi-context dependencies.*

**Manual Verification Checklist:**
- [ ] Load unpacked extension in Chrome (`chrome://extensions`)
- [ ] Click popup; log in with email/password
- [ ] Navigate to Trail Life Connect attendance page
- [ ] Sync button is visible and active
- [ ] Click Sync; member names populate from Supabase `Approved` scans
- [ ] Log out from popup; Sync button becomes disabled/inert

---

### Phase 6: Cloudflare Pages Deployment

**Steps (configuration, no code changes):**
1. Push `frontend/` to its own GitHub repository
2. In the Cloudflare dashboard → **Pages** → Create a new project → Connect GitHub repo
3. Set build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Add environment variables in Cloudflare Pages settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. In Pages → Custom domains → Add `tlc.goodplusfast.com` (Cloudflare handles DNS automatically since you own the domain there)
6. In Supabase → Authentication → URL Configuration: add `https://tlc.goodplusfast.com` to allowed redirect URLs

**Recommended Model:** `Gemini 3.1 Pro (Low)`
*Straightforward deployment configuration; no complex logic required. You already know the Cloudflare workflow from goodplusfast.com.*

**Manual Verification Checklist:**
- [ ] Cloudflare Pages build succeeds without errors
- [ ] `https://tlc.goodplusfast.com` loads the Login page
- [ ] Login, Dashboard, and Scanner all work on the production URL
- [ ] Supabase auth redirect works (no CORS or cookie errors in DevTools)
- [ ] HTTPS is active (automatic via Cloudflare)

---

## Architecture Doc Updates
*(To be created/updated as phases complete)*

| Doc | Created In | Content |
| :--- | :--- | :--- |
| `docs/architecture/` | Phase 1 | Contains `00_overview.md` through `04_scan_lifecycle.md` (Schema, RLS, QR payload, Scan lifecycle) |
| `docs/auth_flow.md` | Phase 2 | Supabase JWT lifecycle across web app + extension |
| `docs/hosting.md` | Phase 6 | Cloudflare Pages setup steps |

---

## Deferred to Future MVPs
- Multi-troop / multi-tenancy (schema is ready)
- Stripe billing & subscription management
- Subscription expiry banner with Billing Admin name
- Demo mode (10-day, 3-member limit)
- Role-based onboarding walkthrough
- Chrome Web Store submission
