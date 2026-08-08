# Architectural Pattern 07: Table Patterns & Excel-like Filtering/Sorting

This document establishes the canonical table architecture for the app. The Events (`/events`) and Session History (`/sessions`) screens serve as the **prototype implementation** for all current and future data table screens across the application.

---

## 1. Table Layout Strategies: `.grid-table-*` vs `DataTable`

The app uses two table presentation strategies depending on UI density and mobile UX requirements:

| Strategy | Component / CSS | Best Used For | Mobile Behavior |
|:---|:---|:---|:---|
| **Responsive Grid Table (Prototype Standard)** | `.grid-table-container`, `.grid-table-header`, `.grid-table-row`, `.grid-table-cell` | Complex screens requiring rich card layouts on mobile (e.g. Events, Sessions, main Roster) | Flattens header and transforms each row into a glassmorphism card |
| **Standard HTML Table** | `DataTable.jsx` (`<table>`) | Secondary/nested data lists or simple tabular views (e.g. Session Attendee detail modal) | Horizontal scrolling overflow container |

> **Architectural Standard**: When building primary management screens, prefer the `.grid-table-*` responsive grid morph to ensure standard card-based mobile presentation.

---

## 2. Canonical Filter & Sort State Contract

All screens implementing full Excel-like filtering must manage state adhering to the following structure:

```js
// Sort State
const [sortConfig, setSortConfig] = useState({
  key: null,        // column key (e.g., 'event_name', 'event_date')
  direction: 'asc'  // 'asc' | 'desc'
});

// Column Filters State
const [columnFilters, setColumnFilters] = useState({
  event_name: [],
  event_date: { from: '', to: '' },
  status: [],       
  synced_by: [],
  actions: []
});
```

### State Persistence Convention
Filter and sort state must persist in `localStorage` scoped to the active user to preserve view preferences across navigation and reloads:
- Storage Key Pattern: `tlc_table_<screen_name>_<userId>`
- Schema: `{ sortConfig, columnFilters }`

### Role Gating Standard
To check user permissions for bulk operations or administrative actions, inspect `selectedTroop?.currentUserRole`:
```js
const currentUserRole = selectedTroop?.currentUserRole;
const canManage = isGlobalAdmin || currentUserRole === 'billing_admin' || currentUserRole === 'troop_admin';
```

---

## 3. Column Header & Interaction Rules

1. **No Standalone Funnel Buttons**: Do **not** render separate filter funnel icon buttons (`filter-funnel-btn` or `🌪️`) in column headers.
2. **Title Click Triggers Popover**: Clicking directly on the column title button toggles the `FilterPopover` dropdown for that column.
3. **Inline Active Filter Indicator**: When a column has active filter criteria applied, append ` 🌪️` inline inside the column header button label.
4. **Inline Sort Direction Indicator**: When a column is actively sorted, append ` ↑` (ascending) or ` ↓` (descending) inline inside the column header button label. Do **not** display an unsorted indicator (e.g. ` ↕`) for columns that are not sorted.
5. **Left-Aligned Actions Header**: The `Actions` column header must be left-aligned (`justifyContent: 'flex-start'`). Tapping the `Actions` header opens a `FilterPopover` listing available action states (e.g., "Close", "Reopen", "Reset Sync"). Exclude sorting controls (`onSort`) from the `Actions` popover.

---

## 4. Popover UI Layer (`FilterPopover.jsx`)

### Popover Design Standards
- **No Header Bar or Prefix**: Do **not** render a `<div className="filter-popover-header">` header bar or `"Filter "` title prefix. Popovers must be clean, border-less, compact glass-cards.
- **Auto-Dismiss Mechanics**: Popovers close automatically when clicking outside the popover card (backdrop click) or pressing the `Escape` key.
- **Distinct Top Sort Group**: When sorting is supported (`onSort`), render `Sort Ascending` and `Sort Descending` as a distinct, styled top group section (`filter-popover-sort-section`) inside the popover body, separated from filter options by a bottom border line. Provide custom contextual labels (e.g., "Sort A to Z", "Sort Oldest to Newest").
- **Strictly Dynamic Multi-select Options**: Multi-select checkbox options (`type="multiselect"`) MUST be derived dynamically via `useMemo` **strictly from items present in the active dataset** (`events`). Never hardcode option arrays (e.g., do **not** include "Synced" in Status options if no records in the current dataset have the "Synced" status).

### Active Filter Chips Bar
Appears between toolbar and table when 1 or more column filters are active:
- **Architectural Rule**: Sorting is **not** considered a filter and must **not** be displayed as a chip in the active filters bar. Active filter chips and badge counters strictly display active column filters.
- Individual chips displaying `Column: Value` with an `×` remove button.
- Global `Clear All` button resets filters, sort state, and global search text.

---

## 5. Row Selection & Pixel-Perfect Alignment

Screens supporting bulk operations include a multi-select checkbox column to the left of the primary data column:

### Selection Behavior & Alignment
- **Master Checkbox (Header)**: Toggles selection on all currently visible (filtered) rows. Uses `input.indeterminate = isSomeSelected` for partial selection.
- **Row Checkbox**: Toggles selection for individual row IDs.
- **Pixel-Perfect Alignment**: Both the header selection cell and row selection cell MUST use identical padding and flex alignment (`display: flex; align-items: center; justify-content: flex-start; padding-left: 1rem; width: 48px;`) so the checkboxes align vertically.

---

## 6. Single-Row Action Column Rules

### Layout & Alignment
- **Left-Aligned Action Cell**: Row action cells MUST align to the left (`justifyContent: 'flex-start'`) directly beneath the left-aligned `Actions` header text.
- **No Separate "View Attendees" Action Button**: Do **not** render a separate "View Attendees" button in the single-row action cell. The primary record name link (e.g., Event Name) serves as the single mechanism to open attendee detail modals.

### Monochrome Theme-Adaptive SVG Icons
- Action buttons MUST use standardized inline SVG stroke icons with `stroke="currentColor"` (avoid colorful emoji buttons like 🔒 or 🗑️).
- Because `stroke="currentColor"` is used, icons automatically render **black** in light theme (`var(--foreground)`) and **white** in dark theme.

### Always Present & Shaded Grey when Unavailable
- All single-row action icons (Close, Reopen, Reset Sync, Delete) MUST remain present in the DOM for all rows (never conditionally hide them).
- When an action is **available** for a given row:
  - Button is enabled (`disabled={false}`) with `opacity: 1`, `cursor: 'pointer'`, and `color: 'var(--foreground)'`.
- When an action is **unavailable** for a given row:
  - Button is disabled (`disabled={true}`) with `opacity: 0.35`, `color: 'var(--text-secondary)'`, and `cursor: 'not-allowed'`.
  - Provide a clear, descriptive tooltip (`title`) explaining why the action is unavailable (e.g., *"Close unavailable: event is already closed or synced"*).

---

## 7. Floating Bulk Action Bar (`.bulk-action-pill`)

When 1 or more rows are selected via checkboxes, a floating bottom action bar appears containing action buttons (`Close`, `Reopen`, `Reset Sync`, `Delete`).

### Forethought Action Enablement Rules
To prevent invalid state transitions across multi-selected items, bulk actions evaluate conditional status rules across **all** currently selected items:

| Bulk Action | Enablement Condition | Disabled Explanation |
|:---|:---|:---|
| **Close** | `selectedItems.every(s => !s.synced_at && !s.ended_at)` | Disabled if ANY selected item is already ended or synced. |
| **Reopen** | `selectedItems.every(s => !s.synced_at && s.ended_at)` | Disabled if ANY selected item is active or synced. |
| **Reset Sync** | `selectedItems.every(s => s.synced_at)` | Disabled if ANY selected item is not synced. |
| **Delete** | `selectedItems.length > 0 && canManage` | Enabled for any non-empty selection (for authorized roles). |

---

## 8. Replication Checklist for Future Screens

When building or upgrading another page (e.g. `Roster.jsx`) to use this pattern:

- [ ] Import `FilterPopover` and global filter CSS.
- [ ] Implement `columnFilters` and `sortConfig` states initialized from `localStorage` (`tlc_table_<screen>_<userId>`).
- [ ] Use `selectedTroop?.currentUserRole` for permission checks (`canManage`).
- [ ] Define dynamic `useMemo` options for column filters derived strictly from current dataset items.
- [ ] Bind column title buttons to toggle popovers (remove standalone funnel buttons).
- [ ] Display ` 🌪️` for active filters and ` ↑` / ` ↓` for active sort direction inside title buttons (no ` ↕` for unsorted).
- [ ] Left-align `Actions` header and row action cells (`justifyContent: 'flex-start'`).
- [ ] Exclude sorting controls from `Actions` popover.
- [ ] Ensure selection header and row selection cells use identical `padding-left: 1rem` alignment.
- [ ] Use theme-adaptive monochrome SVG icons (`stroke="currentColor"`) for single-row actions.
- [ ] Keep all row actions present in DOM; shade unavailable actions grey (`opacity: 0.35`, `disabled={true}`) with tooltips.
- [ ] Use record title links for detail modals (remove redundant "View" action buttons).
- [ ] Add active filter chips bar under toolbar area.
- [ ] Add mobile Filter/Sort trigger button and bottom sheet drawer.
