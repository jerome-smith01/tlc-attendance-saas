# Verification Plan: Bulk Badge Import QR Scan Optimization

## Manual Verification Steps

### 1. Verification of Previously Failing Badges
1. Navigate to `http://localhost:5173/#/troop/SC-0110/roster/import-badges`.
2. Drop or select the two previously unreadable badge PDFs from:
   `C:\Users\Jerom\My Apps\tlc_attendance_saas\tmp\invalid badges`:
   - `TLUSA-Membership-ID-2023-512622.pdf`
   - `TLUSA-Membership-ID-2024-762089.pdf`
3. Click **Process 2 Badges**.
4. Observe the progress bar during Step 2.
5. In Step 3 (Review & Apply):
   - Verify that neither badge appears in the **🚫 QR Unreadable** bucket.
   - Verify both badges successfully decoded and appear in either **✅ Ready to Link**, **⚠️ Already Linked**, or **❌ No Roster Match** (with member ID populated).

### 2. Verification of Regression with Valid Badges
1. Return to Step 1 (**← Start Over**).
2. Select sample badge files from `C:\Users\Jerom\My Apps\tlc_attendance_saas\tmp\Badges-2026-09-02`.
3. Click **Process Badges**.
4. Confirm they continue to process and decode cleanly without errors.

### 3. Verification of Accessibility & UI
1. Verify keyboard navigation on the dropzone (`Enter` or `Space` opens the file picker).
2. Verify screen reader announcements for the processing progress bar (`aria-valuenow` / `aria-valuemax`).
3. Verify the manual assignment dropdowns in the **No Roster Match** section have appropriate `aria-label` attributes.
