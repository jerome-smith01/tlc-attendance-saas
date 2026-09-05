# Verification Plan: Expiration Date Sorting & Filtering

## Manual Verification Steps

### 1. Verification of Sorting
1. Open browser to `http://localhost:5173/#/troop/SC-0110/roster/members`.
2. Locate the **Members** tab table.
3. Click the **Expiration Date** header button.
4. Verify the popover opens and displays:
   - "Sort Earliest First" button
   - "Sort Latest First" button
   - List of unique expiration dates as filter checkboxes.
5. Click **Sort Earliest First**:
   - Verify table reorders members with earliest expiration dates at the top.
   - Verify members with no expiration date (`—`) appear at the bottom.
   - Verify column header updates to display `Expiration Date ↑`.
6. Click **Sort Latest First**:
   - Verify table reorders members with latest expiration dates at the top.
   - Verify members with no expiration date (`—`) appear at the bottom.
   - Verify column header updates to display `Expiration Date ↓`.

### 2. Verification of Filtering
1. Open the **Expiration Date** popover.
2. Select 1 or 2 specific dates from the multiselect list.
3. Verify table updates to display only members matching the selected dates.
4. Verify an active filter funnel icon `🌪️` appears in the Expiration Date header label.
5. Verify an active filter chip (e.g. `Expiration Date: 10/15/2025`) appears in the active filter bar above the table.
6. Click the `×` on the chip or click "Clear all filters" to confirm filters are removed.

### 3. Verification of Accessibility
1. Using keyboard navigation (`Tab` / `Shift+Tab`), focus the **Expiration Date** header button.
2. Verify visual focus outline is visible.
3. Press `Enter` or `Space` to open popover.
4. Press `Escape` key to close popover.
5. Verify `aria-sort` attribute on the header cell updates dynamically (`ascending`, `descending`, or `none`).

### 4. State Persistence Verification
1. Sort by Expiration Date and apply a date filter.
2. Refresh the browser page (`F5`).
3. Verify the Expiration Date sort direction and applied filter persist.
