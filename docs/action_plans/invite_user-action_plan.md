# Invite Existing Users to a New Troop (Option A)

Allow users already registered in TLC Attendance to receive a custom invite email and accept it before being added to a new troop.

## User Review Required

> [!IMPORTANT]
> This plan requires a **Resend** account and API key. Resend has a free tier (3,000 emails/month). Sign up at https://resend.com and create an API key.
>
> The `RESEND_API_KEY` will need to be set as a **Supabase Edge Function secret**:
> ```
> supabase secrets set RESEND_API_KEY=re_xxxxx
> ```

> [!IMPORTANT]
> You must own/verify a sending domain with Resend, or use their sandbox domain (`@resend.dev`) for testing. The `from` email address in the Edge Function will need to be updated to match.

---

## Architecture Overview

```
Invite Flow (Existing User):
  Admin clicks "Send Invite"
        │
        ▼
  invite-user Edge Function
  ├── [New User] → inviteUserByEmail() as before
  └── [Existing User, Not in Troop] →
        ├── Generate UUID token
        ├── Insert into pending_invites (email, troop_id, role, token, expires_at)
        └── Send email via Resend with link: /accept-invite?token=<uuid>

Accept Flow:
  User clicks link in email
        │
        ▼
  AcceptInvite page (new frontend page)
  ├── Reads `token` from URL params
  ├── Calls accept-invite Edge Function
  │     ├── Validates token is valid & not expired
  │     ├── Confirms logged-in user's email matches invite email
  │     ├── Inserts into troop_users (user_id, troop_id, role)
  │     └── Deletes from pending_invites
  └── Redirects to Dashboard with success message
```

---

## Proposed Changes

### 1. Database

#### [NEW] `supabase/migrations/005_pending_invites.sql`
- Create `pending_invites` table:
  - `id` UUID PK
  - `email` TEXT NOT NULL
  - `troop_id` UUID FK → troops
  - `role` troop_role ENUM
  - `token` UUID NOT NULL UNIQUE (DEFAULT gen_random_uuid())
  - `invited_by` UUID FK → auth.users
  - `expires_at` TIMESTAMPTZ NOT NULL (DEFAULT now() + interval '7 days')
  - `created_at` TIMESTAMPTZ
- RLS: No direct user access; only the service role (Edge Function) reads/writes this table.

---

### 2. Edge Functions

#### [MODIFY] [`invite-user/index.ts`](file:///c:/Users/Jerom/My%20Apps/tlc_attendance_saas/supabase/functions/invite-user/index.ts)
- After permission check, **look up whether the email exists** in `auth.users` using `supabaseAdmin.auth.admin.listUsers()` (search by email).
- **Case 1: New User** → call `inviteUserByEmail()` as before (no change).
- **Case 2: Existing User, Already in This Troop** → return a clear error: *"This person is already a member of this troop."*
- **Case 3: Existing User, Not in This Troop** →
  - Delete any stale pending invite for this (email, troop_id) combo.
  - Insert a new row into `pending_invites`.
  - Call Resend API to send a custom invite email.
  - Return `{ success: true, message: 'Invite email sent.' }`.

#### [NEW] `supabase/functions/accept-invite/index.ts`
- Receives `{ token }` in the request body.
- Validates the token exists and is not expired.
- Checks the logged-in user's email matches `pending_invites.email`.
- Inserts into `troop_users (user_id, troop_id, role)`.
- Deletes the `pending_invites` row.
- Returns success or a descriptive error.

---

### 3. Frontend

#### [NEW] `frontend/src/pages/AcceptInvite.jsx`
- Reads `?token=<uuid>` from the URL.
- If user is not logged in: shows a message prompting them to log in first, preserving the token in the URL.
- If user is logged in: calls the `accept-invite` Edge Function with the token.
- Shows success (redirects to Dashboard) or error state.

#### [MODIFY] [`frontend/src/App.jsx`](file:///c:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/App.jsx) (or router file)
- Add route `/accept-invite` → `<AcceptInvite />`.

#### [MODIFY] [`frontend/src/components/InviteUser.jsx`](file:///c:/Users/Jerom/My%20Apps/tlc_attendance_saas/frontend/src/components/InviteUser.jsx)
- Update error message handling so the generic "already invited" message is replaced with more specific feedback from the Edge Function (e.g. "already a member of this troop" vs "invite sent").

---

## Verification Plan

### Manual Verification
1. Invite a **brand-new email** → should still work as before (Supabase invite flow).
2. Invite an **existing user who is already in the troop** → should show "already a member" error.
3. Invite an **existing user NOT in the troop** → should show success, and the invite email should arrive.
4. Click the invite link while **logged out** → should prompt to log in first, then redirect back.
5. Click the invite link while **logged in as the correct user** → should accept and redirect to Dashboard.
6. Click an **expired link** (after 7 days) → should show "This invite has expired."
7. Click the **same link twice** → second attempt should show "This invite is no longer valid."
