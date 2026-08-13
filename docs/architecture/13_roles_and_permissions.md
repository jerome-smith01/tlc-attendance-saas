# Roles and Permissions

This document outlines the plain-English role definitions, permission matrix, and onboarding flows for the TLC Attendance platform.

## Role Definitions

- **Troop Admin (`troop_admin`)**: The primary account owner for a troop. Has full control over the troop's subscription, billing, and roster, including managing other leaders. (Limit: One per troop in current scope).
- **Roster Manager (`roster_manager`)**: A leader with full operational control over the troop's roster, events, and attendance. Cannot manage billing.
- **Badge Scanner (`badge_scanner`)**: A focused role designed for leaders or volunteers taking attendance at the door. Can scan badges, view events, record attendance, and remove/delete scans from the attendance log in Scanner view. Cannot manage the troop roster, edit leaders, or close/delete events.
- **Global Admin (`global_admin`)**: System administrator (us). Has full access to all troops, billing, and settings.

## Role-Permission Matrix

| Action / Capability | `global_admin` | `troop_admin` | `roster_manager` | `badge_scanner` |
|---|:---:|:---:|:---:|:---:|
| **See all troops in dropdown** | ✅ | ❌ (Own troops) | ❌ (Own troops) | ❌ (Own troops) |
| **View Roster tab** | ✅ | ✅ | ✅ | ❌ (Redirected) |
| **Add/Invite Leaders** | ✅ | ✅ | ✅ | ❌ |
| **Edit Leaders** | ✅ | ✅ | ✅ | ❌ |
| **Add/Edit Members (Youth)** | ✅ | ✅ | ✅ | ❌ |
| **Scan Badges & Record Attendance** | ✅ | ✅ | ✅ | ✅ |
| **Remove/Delete Scans from Attendance Log** | ✅ | ✅ | ✅ | ✅ |
| **View/Manage Billing** | ✅ | ✅ | ❌ | ❌ |
| **Close / End Events (Approves for Sync)** | ✅ | ✅ | ✅ | ❌ |
| **Delete Events** | ✅ | ✅ | ✅ | ❌ |
| **View TLC Extension tab** | ✅ | ✅ | ✅ | ❌ |
| **Sync attendance** | ✅ | ✅ | ✅ | ❌ |
| **Edit Troop Metadata** | ✅ | ✅ | ❌ | ❌ |
| **Roster Visibility Rule** | ❌ (Not shown in roster) | Listed as Leader | Listed as Leader | Listed as Leader |
| **Import CSV (Default Role)** | `trailman` | `trailman` | `trailman` | N/A |

## Onboarding Flow by Role

1. **Troop Admin**: Creates the troop account, sets up the subscription, and receives the `troop_admin` role automatically.
2. **Roster Manager & Badge Scanner**: Invited by a Troop Admin or another Roster Manager via the "Invite Leader" flow. Receives an email invitation.
3. **Members (Trailmen)**: Added manually or imported via CSV. They do not have login access to the platform (attendance is tracked by leaders).

### UI Permission Enforcement & Disabled States
When a restricted role (e.g., `badge_scanner`) views screens or actions that require higher permissions (such as event closing, reopening, deleting, or manual attendance editing):
- Actions and context menus remain rendered in the interface to prevent layout shifts or empty popover glitches.
- Unauthorized controls render in a disabled / greyed out state (`opacity: 0.4; cursor: not-allowed`) with a descriptive `title` tooltip explaining the required permission (e.g., *"Close unavailable: requires admin role"*).

### Future: QR Join Flow and Approval Gating
*(Placeholder for future implementation)*
A planned feature where parents/members can scan a QR code at meetings to request to join a troop, requiring approval from a Roster Manager or Troop Admin.
