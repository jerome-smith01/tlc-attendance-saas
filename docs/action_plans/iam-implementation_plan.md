# IAM Implementation Plan

> **Status**: Approved — ready for implementation.
> **Model default**: Google Flash 3.6 Medium (unless noted otherwise per phase)
> **Architecture Docs Rule**: Architecture documentation in `docs/architecture/` must be updated at each phase as features are implemented, with Phase 9 serving as the final audit and consolidation step.

---

## Background & Key Findings

From codebase analysis:

- **`ProtectedRoute`** checks roles but has **no onboarding gate**. The soft redirect in `TroopContext` (`window.location.hash = '#/profile'`) is bypassable by direct URL navigation.
- **`accept-invite-new-user`** creates the auth user and `troop_users` row but **does not create a roster entry** and does not accept name fields. Password minimum is 6 chars.
- **`accept-invite`** (existing user) correctly carries over the name from another roster entry and sets `onboarding_completed: hasExistingName`.
- **`SidebarLayout`** re-fetches user display name when `location.pathname` changes — replacing `window.location.reload()` with `navigate('/events')` fixes the refresh bug cleanly.
- **`Profile.jsx`** already calls `complete_user_onboarding()` and bulk-updates roster across all troops, but renders the full settings page rather than a focused onboarding wizard.
- **No DB migrations required** for Phases 1–8. Existing schema is sufficient.

---

## Phase 1 — Shared: `PasswordStrengthMeter` Component
**Model**: Flash 3.6 ✓

### Files
#### [NEW] [`PasswordStrengthMeter.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/components/PasswordStrengthMeter.jsx)

A reusable UI component accepting a `password` string prop. Renders:
- A color-coded strength bar: Weak (red) / Fair (orange) / Strong (green) / Very Strong (green+)
- An inline checklist (✓/✗) for each rule:
  - At least 8 characters
  - At least 1 uppercase letter
  - At least 1 number or special character
- No third-party library — pure scoring function

**Exported helper**: `passwordMeetsMinimum(password): boolean` — used by any form to gate its submit button.

#### [MODIFY] [`docs/architecture/05_frontend_patterns.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/05_frontend_patterns.md)
- Added Section 14: "Password Strength Meter Pattern" — documents `PasswordStrengthMeter` component and `passwordMeetsMinimum()` helper function. ✓

### ✅ Phase 1 Verification Gate
Before advancing to Phase 2, verify:
- [ ] Component renders without errors when imported into `AcceptInvite.jsx` (temporary test placement)
- [ ] Typing `abc` → bar shows Weak, checklist shows all ✗
- [ ] Typing `Abcdefg1` → bar shows Strong/Very Strong, checklist shows all ✓
- [ ] `passwordMeetsMinimum('abc')` returns `false`; `passwordMeetsMinimum('Abcdefg1')` returns `true`

---

## Phase 2 — `TroopContext` Updates
**Model**: Flash 3.6 ✓

### Files
#### [MODIFY] [`TroopContext.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/context/TroopContext.jsx)

**Change 1 — Expose `needsOnboarding` as context state**
- Add `const [needsOnboarding, setNeedsOnboarding] = useState(false)`
- In `fetchTroops()`, set `needsOnboarding = data?.some(tu => tu.onboarding_completed === false)`
- Remove the existing `window.location.hash` soft redirect (the Phase 3 route guard replaces it)
- Add `needsOnboarding` to context value

**Change 2 — Shared display name state**
- Add `userDisplayName` (string) and `refreshDisplayName()` (async function) to context
- `refreshDisplayName()` fetches `first_name + last_initial` from `roster` for `user.id` + `selectedTroopId`; formats as `"FirstName L."`
- Runs automatically when `user` or `selectedTroopId` changes (replaces the inline fetch in `SidebarLayout`)
- Add both to context value

#### [MODIFY] [`docs/architecture/05_frontend_patterns.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/05_frontend_patterns.md)
- Update Section 2 "Troop Context & Multi-Troop Switching": document `needsOnboarding` state, `userDisplayName`, and `refreshDisplayName()`.

### ✅ Phase 2 Verification Gate
Before advancing to Phase 3, verify:
- [ ] For a user with `onboarding_completed = false` in the DB: `useTroop().needsOnboarding` is `true` (verify via `console.log` or React DevTools)
- [ ] `userDisplayName` shows the correct `"FirstName L."` format in the sidebar (sidebar reads it from context in Phase 8, but you can log it here)
- [ ] Switching troops in the dropdown triggers `refreshDisplayName()` and updates the value

---

## Phase 3 — Hard Onboarding Gate in `ProtectedRoute`
**Model**: Flash 3.6 ✓

### Files
#### [MODIFY] [`ProtectedRoute.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/components/ProtectedRoute.jsx)

Add after the role authorization check:
```jsx
const { needsOnboarding } = useTroop();

if (needsOnboarding && location.pathname !== '/profile') {
  return <Navigate to="/profile" replace />;
}
```

- Uses `useLocation()` from `react-router-dom` (already available via import)
- `/profile` is allowed through so the user can complete onboarding without an infinite redirect loop
- `/accept-invite` and `/login` are public routes outside `ProtectedRoute` — unaffected

#### [MODIFY] [`docs/architecture/02_rls_and_auth.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/02_rls_and_auth.md) & [`docs/architecture/05_frontend_patterns.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/05_frontend_patterns.md)
- Document hard route-level onboarding gate pattern in `ProtectedRoute` and `needsOnboarding` enforcement.

### ✅ Phase 3 Verification Gate
Before advancing to Phase 4, verify:
- [ ] Log in as a user whose `onboarding_completed = false` in `troop_users`. Manually navigate to `/#/events` → redirected to `/#/profile`
- [ ] Manually navigate to `/#/dashboard` → redirected to `/#/profile`
- [ ] The `/#/profile` page itself loads without redirect loop
- [ ] Log in as a fully-onboarded user (`onboarding_completed = true`) → `/#/events` loads normally

---

## Phase 4 — `AcceptInvite` New-User Form Redesign
**Model**: Flash 3.6 ✓

### Files
#### [MODIFY] [`AcceptInvite.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/pages/AcceptInvite.jsx)

**New-user form (`accountExists = false`):**

| Field | Type | Rule |
|---|---|---|
| Email | Text (read-only) | Pre-filled from `inviteDetails.email` |
| First Name | Text | Required |
| Last Initial | Text (max 1 char) | Required, auto-uppercased |
| Password | Password | Required — renders `<PasswordStrengthMeter />` below |
| Confirm Password | Password | Required, must match |

- Submit disabled until `passwordMeetsMinimum()` is true and all fields filled
- Passes `firstName`, `lastInitial` in the body to `accept-invite-new-user`
- On success: use `navigate('/events')` — **no `window.location.reload()`**

**Existing-user form (`accountExists = true`):** No field changes (password only). Google OAuth button added in Phase 7.

#### [MODIFY] [`docs/architecture/05_frontend_patterns.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/05_frontend_patterns.md)
- Document single-form new user invitation acceptance pattern (Email, First Name, Last Initial, Password).

### ✅ Phase 4 Verification Gate
Before advancing to Phase 5, verify:
- [ ] Invite a brand-new email → click link → see First Name, Last Initial, Password, Confirm Password fields (no extras)
- [ ] Invite an existing user → click link → see Password field only (no name fields)
- [ ] Typing a weak password on the new-user form → submit button disabled
- [ ] Typing `Abcdefg1` → submit button enabled (form submits, but edge function will reject until Phase 5 is done — that's expected)

---

## Phase 5 — Edge Function Updates
**Model**: 🔴 Use **Pro** — security-critical backend, server-side validation, rollback logic

### Files
#### [MODIFY] [`accept-invite-new-user/index.ts`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/supabase/functions/accept-invite-new-user/index.ts)

1. **Accept `firstName` and `lastInitial`** in request body — required, validated server-side (non-empty)
2. **Update password validation**: minimum 8 chars, at least 1 uppercase, at least 1 number or special char
3. **Create roster entry** immediately after `troop_users` insert:
   ```ts
   await supabaseAdmin.from('roster').insert([{
     troop_id: inviteData.troop_id,
     user_id: newUser.user.id,
     email: normalizedEmail,
     first_name: firstName.trim(),
     last_initial: lastInitial.trim().charAt(0).toUpperCase(),
     role: inviteData.role
   }])
   ```
4. **Set `onboarding_completed: true`** in the `troop_users` insert
5. Roster insert included in rollback sequence (delete auth user if either insert fails)

#### [MODIFY] [`accept-invite/index.ts`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/supabase/functions/accept-invite/index.ts)

No logic changes. Minor only: update any password error message wording to reference 8 characters for consistency.

#### [MODIFY] [`docs/architecture/02_rls_and_auth.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/02_rls_and_auth.md)
- Document `accept-invite-new-user` edge function flow & instant roster row creation with rollback logic.

### ✅ Phase 5 Verification Gate
Before advancing to Phase 6, verify:
- [ ] Complete a full new-user invite: fill First Name, Last Initial, `Abcdefg1` as password → submit
- [ ] In Supabase dashboard: confirm `roster` row exists with correct `first_name` + `last_initial`
- [ ] Confirm `troop_users` row has `onboarding_completed = true`
- [ ] Confirm user can log in with the new password
- [ ] Confirm submitting with password `abc` → edge function returns error (password too weak)
- [ ] Confirm submitting with empty First Name → edge function returns error

---

## Phase 6 — Profile Page Onboarding Wizard Mode
**Model**: Flash 3.6 ✓

### Files
#### [MODIFY] [`Profile.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/pages/Profile.jsx)

**Detect onboarding mode**: `const { needsOnboarding, refreshDisplayName } = useTroop()`

**When `needsOnboarding = true`**, render a focused "Complete Your Profile" wizard instead of the full settings page:
- Page title: "Complete Your Profile"
- Subtitle: "Please set up your profile before you can continue."
- Fields: **First Name** + **Last Initial** only
- Password field: shown only if `user.identities` contains the `email` provider AND no password has been set (detect via `user.app_metadata?.providers` — if only `google`, skip it; if `email` or both, show it)
- Single CTA: "Save & Continue"

**After successful wizard save**:
- Call `complete_user_onboarding()` RPC
- Call `refreshDisplayName()` from `useTroop()`
- Use `navigate('/events')` — **no `window.location.reload()`**

**For non-onboarding profile saves** (editing name from the full profile page):
- After save: call `refreshDisplayName()`
- Show success toast
- No navigation

**Password change section** (full profile page, non-onboarding):
- Add `<PasswordStrengthMeter />` below the New Password field
- Update validation to 8-char + uppercase + number/special char
- For OAuth-only users (no `email` provider): replace the "Change Password" section with an "Add a Password" section that does not require a current password (dual-provider — sets a password for the first time)

#### [MODIFY] [`docs/architecture/05_frontend_patterns.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/05_frontend_patterns.md)
- Update Section 12 "User Profile & Security Settings Pattern": document Onboarding Wizard mode for incomplete profiles.

### ✅ Phase 6 Verification Gate
Before advancing to Phase 7, verify:
- [ ] Log in as a user with `onboarding_completed = false` → `/profile` shows wizard (no member code, no role display, no password section by default)
- [ ] Fill First Name + Last Initial → click "Save & Continue" → navigated to `/events` **without a page reload**
- [ ] Sidebar shows `"FirstName L."` immediately after redirect (no manual browser refresh needed)
- [ ] `onboarding_completed` is now `true` in the DB
- [ ] Phase 3 gate no longer triggers for this user
- [ ] On the full profile page (onboarded user): password change section shows `<PasswordStrengthMeter />` and rejects weak passwords

---

## Phase 7 — Google OAuth
**Model**: 🔴 Use **Pro** — OAuth redirect bridge with sessionStorage, security-sensitive flow

### Manual Prerequisite (you complete in Supabase dashboard before coding begins):
1. Supabase → Authentication → Providers → Google → Enable
2. Enter your Google OAuth Client ID + Secret (from Google Cloud Console)
3. Add to Redirect URLs: `http://localhost:5173` and `https://tlc.goodplusfast.com`

### Files
#### [MODIFY] [`Login.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/pages/Login.jsx)

- Add "Continue with Google" button above the email/password form, separated by an "or" divider
- On click:
  ```js
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
  ```
- After OAuth redirect: `onAuthStateChange` fires → existing `useEffect` in Login navigates to `/events` → Phase 3 gate handles onboarding if needed

#### [MODIFY] [`AcceptInvite.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/pages/AcceptInvite.jsx)

**Existing-user form** — add "Sign in with Google" button:
```js
// Store invite token before leaving for OAuth
sessionStorage.setItem('pending_invite_token', token);
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin }
});
```

**On mount**, check for stored token:
```js
const pendingToken = sessionStorage.getItem('pending_invite_token');
if (pendingToken && session) {
  sessionStorage.removeItem('pending_invite_token');
  // Navigate back to accept-invite with the token
  navigate(`/accept-invite?token=${pendingToken}`);
}
```

The existing auto-accept `useEffect` then handles validation + acceptance as normal.

**Email mismatch via OAuth**: If the Google account email ≠ invited email → show existing mismatch screen.

#### [MODIFY] [`docs/architecture/02_rls_and_auth.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/02_rls_and_auth.md) & [`docs/architecture/05_frontend_patterns.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/05_frontend_patterns.md)
- Document Google OAuth provider, sessionStorage invite token bridge, and dual-provider password linking.

### ✅ Phase 7 Verification Gate
Before advancing to Phase 8, verify:
- [ ] "Continue with Google" button appears on `/login`
- [ ] Clicking opens Google auth dialog
- [ ] After Google sign-in: lands on `/events` (or `/profile` if onboarding needed)
- [ ] Invite link for existing user → click "Sign in with Google" → after OAuth, invite is auto-accepted → lands on `/events`
- [ ] Invite for `userA@gmail.com`, sign in with Google as `userB@gmail.com` → mismatch screen shown
- [ ] New email/password user still works (OAuth is additive only)

---

## Phase 8 — Sidebar Display Name Auto-Refresh
**Model**: Flash 3.6 ✓

*Depends on Phase 2 (TroopContext `userDisplayName` state).*

### Files
#### [MODIFY] [`SidebarLayout.jsx`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/components/SidebarLayout.jsx)

- Remove inline `loadUserName` `useEffect` and `userName` local state
- Read `userDisplayName` from `useTroop()` instead
- `getDisplayName()` checks `userDisplayName` first, falls back to `user_metadata.full_name`, then email prefix (same fallback order as before)

#### [MODIFY] [`docs/architecture/05_frontend_patterns.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/05_frontend_patterns.md)
- Document sidebar display name auto-refresh from context.

### ✅ Phase 8 Verification Gate
Before advancing to Phase 9, verify:
- [ ] Update First Name in `/profile` → sidebar updates immediately, no page reload
- [ ] Switch troop in dropdown → sidebar shows correct name for new troop
- [ ] Log out and back in → sidebar name still correct on first load

---

## Phase 9 — Architecture Documentation
**Model**: Flash 3.6 ✓

### Files

#### [NEW] [`docs/architecture/13_roles_and_permissions.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/13_roles_and_permissions.md)
- Plain-English role definitions for `billing_admin`, `troop_admin`, `badge_scanner`, `global_admin`
- Full role-permission matrix (basis for future KB article)
- Onboarding flow by role
- One `billing_admin` per troop rule; no role transfer in current scope
- Future: QR join flow and approval gating (placeholder)

#### [MODIFY] [`docs/architecture/00_overview.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/00_overview.md)
- Auth row in tech stack table: `Supabase Email/Password` → `Supabase Auth (Email/Password + Google OAuth)`
- `ProtectedRoute` description: add "hard onboarding gate — redirects users with incomplete profiles to `/profile`"
- `TroopContext` description: add `needsOnboarding`, `userDisplayName`, `refreshDisplayName()`
- Documentation index: add entry for `13_roles_and_permissions.md`

#### [MODIFY] [`docs/architecture/02_rls_and_auth.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/02_rls_and_auth.md)
- Auth Model section: remove "No OAuth in MVP-1"; update to document Google OAuth as supplemental provider
- Add section: "Onboarding Gate" — documents `needsOnboarding` flag and `ProtectedRoute` enforcement

#### [MODIFY] [`docs/architecture/05_frontend_patterns.md`](file:///C:/Users/Jerom/My%20Apps/tlc_attendance_saas/docs/architecture/05_frontend_patterns.md)
- Section 3 "Protected Routes & Onboarding Flow": update to describe hard route-level gate and `needsOnboarding` pattern
- Add section: "Password Strength Meter" — documents `PasswordStrengthMeter` component and `passwordMeetsMinimum()` helper
- Add section: "Google OAuth Flow" — documents `signInWithOAuth`, sessionStorage invite token bridge, dual-provider pattern

### ✅ Phase 9 Verification Gate
- [ ] All four docs render correctly in the docs viewer with no broken links
- [ ] `13_roles_and_permissions.md` role-permission matrix matches the actual access behaviour from Phase 7 verification

---

## Final Integration & Role-Permission Matrix

*Run after all 9 phases are complete. This matrix matches the structure of `example_matrix.xlsx` and will be documented in `13_roles_and_permissions.md`.*

| Action / Capability | `global_admin` | `billing_admin` | `troop_admin` | `badge_scanner` |
|---|:---:|:---:|:---:|:---:|
| **See all troops in dropdown** | ✅ | ❌ (Own troops) | ❌ (Own troops) | ❌ (Own troops) |
| **View Roster tab** | ✅ | ✅ | ✅ | ❌ (Redirected) |
| **Add/Invite Leaders** | ✅ | ✅ | ✅ | ❌ |
| **Add/Edit Members (Youth)** | ✅ | ✅ | ✅ | ❌ |
| **Scan Badges & Record Attendance** | ✅ | ✅ | ✅ | ✅ |
| **View/Manage Billing** | ✅ | ✅ | ❌ | ❌ |
| **Close / End Sessions** | ✅ | ✅ | ✅ | ❌ |
| **Approve Scans** | ✅ | ✅ | ✅ | ❌ |
| **Edit Troop Metadata** | ✅ | ✅ | ❌ | ❌ |
| **Roster Visibility Rule** | ❌ (Not shown in roster) | Listed as Leader | Listed as Leader | Listed as Leader |
| **Import CSV (Default Role)** | `trailman` | `trailman` | `trailman` | N/A |

### Additional Integration Tests
- **Full new-user flow end-to-end**: Invite brand-new email → click link → fill name + password → submit → redirected to `/events`, name in sidebar lower-left immediately without page reload.
- **Full OAuth new-user flow**: Invite new email → click link → "Sign in with Google" → complete OAuth → onboarding gate triggers if name missing → name saved → redirected to `/events`.
- **Dual-provider**: Sign in with Google → go to Profile → set a password → can now log in via email + password or Google.
- **Sidebar display name on troop switch**: Switch active troop in top bar → display name immediately reflects user's roster record in that troop.

---

## Files Changed Summary

| File | Action | Phase |
|---|---|---|
| `frontend/src/components/PasswordStrengthMeter.jsx` | NEW | 1 |
| `frontend/src/context/TroopContext.jsx` | MODIFY | 2 |
| `frontend/src/components/ProtectedRoute.jsx` | MODIFY | 3 |
| `frontend/src/pages/AcceptInvite.jsx` | MODIFY | 4, 7 |
| `supabase/functions/accept-invite-new-user/index.ts` | MODIFY | 5 |
| `frontend/src/pages/Profile.jsx` | MODIFY | 6 |
| `frontend/src/pages/Login.jsx` | MODIFY | 7 |
| `frontend/src/components/SidebarLayout.jsx` | MODIFY | 8 |
| `docs/architecture/13_roles_and_permissions.md` | NEW | 9 |
| `docs/architecture/00_overview.md` | MODIFY | 9 |
| `docs/architecture/02_rls_and_auth.md` | MODIFY | 9 |
| `docs/architecture/05_frontend_patterns.md` | MODIFY | 9 |
