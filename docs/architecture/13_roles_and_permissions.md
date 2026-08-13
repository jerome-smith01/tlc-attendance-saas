# Roles and Permissions

This document outlines the plain-English role definitions, permission matrix, and onboarding flows for the TLC Attendance platform.

## Role Definitions

- **Troop Admin (`troop_admin`)**: The primary account owner for a troop. Has full control over the troop's subscription, billing, and roster, including managing other leaders. (Limit: One per troop in current scope).
- **Roster Manager (`roster_manager`)**: A leader with full operational control over the troop's roster, events, and attendance. Cannot manage billing.
- **Badge Scanner (`badge_scanner`)**: A restricted role designed for leaders or volunteers taking attendance at the door. Can only scan badges, view events, and record attendance. Cannot manage the roster or edit events.
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
| **View/Manage Billing** | ✅ | ✅ | ❌ | ❌ |
| **Close / End Events (Approves for Sync)** | ✅ | ✅ | ✅ | ❌ |
| **View TLC Extension tab** | ✅ | ✅ | ✅ | ❌ |
| **Sync attendance** | ✅ | ✅ | ✅ | ❌ |
| **Edit Troop Metadata** | ✅ | ✅ | ❌ | ❌ |
| **Roster Visibility Rule** | ❌ (Not shown in roster) | Listed as Leader | Listed as Leader | Listed as Leader |
| **Import CSV (Default Role)** | `trailman` | `trailman` | `trailman` | N/A |

## Onboarding Flow by Role

1. **Troop Admin**: Creates the troop account, sets up the subscription, and receives the `troop_admin` role automatically.
2. **Roster Manager & Badge Scanner**: Invited by a Troop Admin or another Roster Manager via the "Invite Leader" flow. Receives an email invitation.
3. **Members (Trailmen)**: Added manually or imported via CSV. They do not have login access to the platform (attendance is tracked by leaders).

### Future: QR Join Flow and Approval Gating
*(Placeholder for future implementation)*
A planned feature where parents/members can scan a QR code at meetings to request to join a troop, requiring approval from a Roster Manager or Troop Admin.
