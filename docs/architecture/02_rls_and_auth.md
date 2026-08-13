# Row Level Security, Authentication, and Roles

## Auth Model
Supabase authentication supports both email/password credentials and Google OAuth (`supabase.auth.signInWithOAuth()`). The JWT lifecycle is managed entirely by the `supabase-js` client.

For invitation flows, a `sessionStorage` token bridge (`pending_invite_token`) preserves the invitation token across OAuth redirects. Dual-provider password linking allows OAuth users to optionally add a password to their account from their Profile settings page.

---

## Role System Overview

There are **two parallel role systems** in this app:

1. **`troop_users.role`** (`troop_role` ENUM): Controls backend database access via RLS. Values: `troop_admin`, `roster_manager`, `badge_scanner`.
2. **`roster.role`** (TEXT check constraint): Labels a roster row as a person type. Values: `trailman`, `troop_admin`, `roster_manager`, `badge_scanner`. Mirrors the `troop_role` for leaders; Trailmen (youth) use `trailman`.
3. **`global_admins` table**: A system-level bypass. Users in this table bypass all troop-level role checks. Used for platform owner access only.

> **Naming History**: The roles were originally `admin` and `member` (migration 001). They were renamed to `troop_admin` and `badge_scanner` in migration 003. They were later renamed to `roster_manager` and `troop_admin` in migration 017. All code and policies use the new names.

---

## Role Definitions & UI/UX Implications

All access is scoped to the user's registered troop(s). The `TroopContext` on the frontend allows users with multiple troop memberships to switch between them via a dropdown in the sidebar.

| Role | Description / UI Landing | Can Read | Can Write Roster | Can Write Events/Scans | Can Close Event/Sync | Can Manage Users | Can Edit Troop |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| `badge_scanner` | Scanner-focused view | ✅ Own troop | ✅ Insert + Update | ✅ Insert (open events only) | ❌ | ❌ | ❌ |
| `roster_manager` | Full troop admin dashboard | ✅ Own troop | ✅ Full CRUD | ✅ Full CRUD | ✅ | ✅ Invite/remove | ❌ |
| `troop_admin` | Owner dashboard + billing | ✅ Own troop | ✅ Full CRUD | ✅ Full CRUD | ✅ | ✅ Invite/remove | ✅ |
| `global_admin` | All troops (platform owner) | ✅ All troops | ✅ All troops | ✅ All troops | ✅ | ✅ | ✅ |

### Role Details & UI Capabilities

#### 1. Badge Scanner (`badge_scanner`)
* **Purpose**: Event-level scanners — leaders checking in youth at a meeting or event.
* **UI Workflow**:
  - Defaults to the **Scanner Page** or a simplified scanner view.
  - Can create new events and select existing (open) events before scanning.
  - Scanner auto-creates roster records on unknown badge scans (INSERT).
  - Scanner backfills missing `tlc_id` on known members (UPDATE).
  - Can view the attendance log for the current event.
* **UI Exclusions**:
  - Hide all user management and billing options.
  - Hide "Close Event" and "Sync to Trail Life USA" actions.
  - No delete controls on roster items.

#### 2. Roster Manager (`roster_manager`)
* **Purpose**: General troop administrators who manage day-to-day operations.
* **UI Workflow**:
  - Lands on the main **Troop Dashboard** showing troop stats and unsynced event warnings.
  - **Roster Management**: Full CRUD on the roster, including CSV Import from Trail Life Connect.
  - **Event Management**: Can view all events, drill into attendees, close events (`ended_at`), and delete events.
  - **Chrome Extension Sync**: Can log into the extension and run DOM-based sync on `traillifeconnect.com`. Synced events have their `synced_at` and `synced_by` populated.
  - **User Management**: Can invite users by email (Supabase invite), promote/demote between `badge_scanner` and `roster_manager`, and remove users from the troop.
* **UI Exclusions**:
  - Hide subscription/billing management and Stripe portal.
  - Cannot edit core troop metadata (city, state, troop number).

#### 3. Troop Admin (`troop_admin`)
* **Purpose**: Troop owner and billing contact.
* **UI Workflow**:
  - Inherits all **Roster Manager** workflows.
  - **Troop Settings**: Can edit core troop attributes (city, state, troop number).
  - **Billing & Stripe Portal**: Displays billing status banners; links to the Stripe Customer Portal for subscription, payment, and invoice management.

#### 4. Global Admin (`global_admins` table)
* **Purpose**: Platform owner access for system-wide debugging and management.
* **Access**: Bypasses all troop-level RLS via the `user_has_role_in_troop()` helper function.
* **UI Note**: The `TroopContext` exposes an `isGlobalAdmin` flag. The frontend uses this to enable the troop switcher for all available troops rather than just those the user is a member of.

---

## RLS Core Pattern

All RLS policies rely on two helper functions:

### `user_troop_ids()`
Returns the list of `troop_id` UUIDs the authenticated user belongs to via `troop_users`.
```sql
-- Fundamental SELECT policy pattern
USING (troop_id IN (SELECT user_troop_ids()))
```

### `user_has_role_in_troop(p_troop_id, p_roles[])`
Returns TRUE if the user is a `global_admin` OR has one of the specified roles in the given troop.
```sql
-- Used for UPDATE, DELETE, and write-specific INSERT policies
USING (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]))
```
This function is declared `SECURITY DEFINER STABLE`, so it runs with elevated privileges to avoid RLS recursion.

---

## Policy-by-Policy Reference

### `troops`
- **SELECT**: Users can see troops they belong to (via `user_troop_ids()`).
- **UPDATE**: Only `troop_admin` (or `global_admin`).

### `troop_users`
- **SELECT**: Users can see all members of their own troops.
- **INSERT / UPDATE / DELETE**: Only `roster_manager` and `troop_admin` (or `global_admin`).
- **RPC `complete_user_onboarding()`**: `SECURITY DEFINER` function allowing any authenticated user to set `onboarding_completed = true` for their own `troop_users` rows upon completing profile setup.

### `roster`
- **SELECT**: Any troop member.
- **INSERT**: Any troop member OR a user inserting their own record (`user_id = auth.uid()`).
- **UPDATE**: Any troop member for scanning-related updates; OR a user updating their own record; OR `roster_manager`/`troop_admin` for admin edits.
- **DELETE**: Only `roster_manager` and `troop_admin` (or `global_admin`).

### `sessions`
- **SELECT**: Any troop member.
- **INSERT**: Any troop member (leaders can create sessions before scanning).
- **UPDATE / DELETE**: Only `roster_manager` and `troop_admin` (or `global_admin`).

### `scans`
- **SELECT**: Any troop member.
- **INSERT**: Any troop member, **but only if the session's `ended_at IS NULL`** (enforced by the RLS policy, not just the frontend).
- **UPDATE / DELETE**: Only `roster_manager` and `troop_admin` (or `global_admin`).

---

## Design Decisions

### Why can any troop member INSERT and UPDATE the roster?
A leader scanning badges shouldn't need admin privileges. If an unknown badge is scanned, the app creates a roster entry on the fly (INSERT). If a known member's `tlc_id` is missing, the scanner writes it back (UPDATE). These are routine scanning operations, not administrative actions.

### Why is ended_at enforced at the DB level?
The `scans_insert_own_troop` RLS policy checks `AND ended_at IS NULL`. This ensures that even if a frontend bug or API call attempts to add scans to a closed session, the database will reject it. The frontend mirrors this check for UX, but the DB is the source of truth.

---

## Cross-Troop Isolation
The schema includes a `DEMO-001` troop. Because all queries are implicitly filtered by RLS, a user logged into `SC-0110` will never see `DEMO-001` data. This troop exists solely to verify multi-tenancy isolation.

## Onboarding Gate

The system enforces a hard onboarding gate using the `needsOnboarding` flag in `TroopContext` and route protection in `ProtectedRoute`. 
Users with incomplete profiles (e.g. missing names after signing up via OAuth or accepting an invite without providing a name) are automatically redirected to the `/profile` page, preventing access to the main application until their profile is complete.
