# Row Level Security and Authentication

## Auth Model
Supabase email/password authentication is used. No OAuth in MVP-1. The JWT lifecycle is managed entirely by the `supabase-js` client.

## Role Definitions

| Role | Can Read | Can Write Roster | Can Write Sessions/Scans | Can Approve/Sync | Can Manage Users | Can Edit Troop |
|:---|:---|:---|:---|:---|:---|:---|
| `member` | ✅ Own troop | ✅ Insert + Update | ✅ Insert | ❌ | ❌ | ❌ |
| `admin` | ✅ Own troop | ✅ Full CRUD | ✅ Full CRUD | ✅ | ✅ Invite/remove | ❌ |
| `billing_admin` | ✅ Own troop | ✅ Full CRUD | ✅ Full CRUD | ✅ | ✅ Invite/remove | ✅ |

## RLS Core Pattern
All RLS policies rely on the `user_troop_ids()` helper function, which retrieves the list of troops the authenticated user belongs to via `auth.uid()`. 

The fundamental security check across all SELECT policies is:
`USING (troop_id IN (SELECT user_troop_ids()))`

For role-specific checks (UPDATE, DELETE), the `user_has_role_in_troop()` helper is used.

## Policy-by-Policy Reference

### `troops`
- **SELECT**: Users can see troops they belong to.
- **UPDATE**: Only `billing_admin`.

### `troop_users`
- **SELECT**: Users can see all members of their own troops.
- **INSERT / UPDATE / DELETE**: Only `admin` and `billing_admin` can invite, modify, or remove users.

### `roster`
- **SELECT**: Any troop member.
- **INSERT / UPDATE**: Any troop member. (See Scanner Permissions below).
- **DELETE**: Only `admin` and `billing_admin`.

### `sessions` & `scans`
- **SELECT**: Any troop member.
- **INSERT**: Any troop member (leaders scanning at events).
- **UPDATE / DELETE**: Only `admin` and `billing_admin`. (Only admins can approve scans).

## Design Decision: Scanner Permissions
**Why can any troop member INSERT and UPDATE the roster?**
A leader scanning badges at a meeting shouldn't need backend admin access. If an unknown badge is scanned, the app creates a roster entry on the fly (INSERT). If a known member's `tlc_id` is missing, the scanner writes it back (UPDATE). These are routine scanning operations, not administrative actions.

## Cross-Troop Isolation
The schema includes a `DEMO-001` troop. Because all queries are implicitly filtered by RLS, a user logged into `SC-0110` will never see `DEMO-001` data, proving that multi-tenancy isolation is functional.
