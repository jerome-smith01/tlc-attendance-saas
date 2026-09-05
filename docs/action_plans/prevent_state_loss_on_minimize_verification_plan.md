# Manual Verification Plan: Prevent In-Progress State Loss on App Minimize / Blur

## Purpose
This document provides exact, step-by-step instructions for the user to manually verify that in-progress user actions (such as typed email addresses in leader invitations, active badge import wizard results, and open form states) remain completely stable and static when minimizing the browser, switching applications, or returning focus to the application window.

---

## Verification Scenarios

### Scenario 1: Leader Invitation Email Input Stability
1. Start the frontend application if not already running:
   ```powershell
   cd frontend
   npm run dev
   ```
2. Navigate to the Roster Leaders page: `http://localhost:5173/#/troop/SC-0110/roster/leaders`.
3. In the **Invite Leader** card, click into the input field with placeholder `Email address(es)`.
4. Type in: `test-leader@example.com, another-leader@example.com` (do not click Send).
5. Minimize the browser window, or open another program (e.g. File Explorer, VS Code, or Notepad) directly in front of the browser window.
6. Wait 3–5 seconds.
7. Restore or click back into the browser window to return focus.
8. **Verify**:
   - The text `test-leader@example.com, another-leader@example.com` is still present in the input field.
   - The page does not flash a loading spinner or "Loading roster...".
   - Focus is retained and no form rows are reset.

---

### Scenario 2: Bulk Badge Import Results Stability
1. Navigate to: `http://localhost:5173/#/troop/SC-0110/roster/import-badges`.
2. Select or drop one or more badge PDF files.
3. Click **Process Badges** to run QR recognition and reach **Step 3 (Review & Apply)**.
4. Verify the bucket categories ("Ready to Link", "No Roster Match", etc.) are displayed.
5. Minimize the browser window or bring another window to the front.
6. Wait 5 seconds, then bring the browser window back into view and click into it.
7. **Verify**:
   - Step 3 (Review & Apply) remains visible.
   - The processed badge items, buckets, and any dropdown assignments remain exactly as they were.
   - The wizard does not reset to Step 1.

---

### Scenario 3: Member Edit Form Stability
1. Navigate to edit an existing member: `http://localhost:5173/#/troop/SC-0110/roster/members`.
2. Click **Edit** on any member to open the Edit Member screen.
3. Modify a field (e.g., change first name or add notes) without clicking Save.
4. Minimize the browser window, wait a few seconds, and restore it.
5. **Verify**:
   - The modified fields retain their typed values.
   - The page does not re-fetch and overwrite draft changes with database values.

---

### Scenario 4: Accessibility Verification
1. **No Unexpected Context Loss**: Screen reader users and keyboard-only users will no longer experience sudden focus resets or lose form control context when the operating system switches windows (WCAG 2.1 Focus Order & On Focus).
2. **Visual Continuity**: Users with cognitive or vestibular sensitivities will not experience jarring loading flashes (`AppSpinner`) during routine window toggling or background token renewal.
