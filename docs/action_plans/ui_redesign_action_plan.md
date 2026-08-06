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
| 4 | Scanner Screen Redesign | Pending | Gemini 3.1 Pro (High) | Phase 1, 2 |
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
- **File Changes**:
  - `Modify` `src/pages/Scanner.jsx`
- **Key Pattern**: Flexbox/Grid layouts for the collapsible inline table (`grid-template-rows: 1fr to 0fr`). Merging existing hooks (`useScanLogic`) with new JSX structure.
  - **Photo**: Implement as a hidden file input wrapped in a styled button (`scanFile`).
  - **+ Manual Entry**: Implement as a new feature (likely a modal) to add a person to the roster/session if they forgot their badge.
  - **End Session**: Place the destructive "End Session" button next to the session name in the top header.
- **Recommended Model**: Gemini 3.1 Pro (High) - *High-risk integration combining complex existing business logic with a completely new structural UI.*
- **Manual Verification**: Perform a scan in the UI; verify the new scan appears in the collapsible list and the Chrome Extension DOM element is correctly rendered. Verify Manual Entry modal works.

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
