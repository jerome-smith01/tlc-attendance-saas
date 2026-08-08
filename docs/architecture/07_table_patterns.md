# Architectural Pattern 07: Table Patterns & Excel-like Filtering/Sorting

This document establishes the canonical table architecture for the app. The Session History (`/sessions`) screen serves as the **prototype implementation** for all current and future data table screens across the application.

---

## 1. Table Layout Strategies: `.grid-table-*` vs `DataTable`

The app uses two table presentation strategies depending on UI density and mobile UX requirements:

| Strategy | Component / CSS | Best Used For | Mobile Behavior |
|:---|:---|:---|:---|
| **Responsive Grid Table (Prototype Standard)** | `.grid-table-container`, `.grid-table-header`, `.grid-table-row`, `.grid-table-cell` | Complex screens requiring rich card layouts on mobile (e.g. Sessions, main Roster) | Flattens header and transforms each row into a glassmorphism card |
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
  // text filter
  event_name: '',
  
  // daterange filter
  event_date: { from: '', to: '' },
  
  // multiselect filter (array of selected values)
  status: [],       
  synced_by: []
});
```

### State Persistence Convention
Filter and sort state must persist in `localStorage` scoped to the active user to preserve view preferences across navigation and reloads:
- Storage Key Pattern: `tlc_table_<screen_name>_<userId>`
- Schema: `{ sortConfig, columnFilters }`

---

## 3. Column Definition Schema

Table columns are defined as structured arrays with extended filtering capabilities:

```js
const columns = [
  {
    key: 'event_name',
    label: 'Event Name',
    sortable: true,
    filterType: 'text', // 'text' | 'daterange' | 'multiselect'
  },
  {
    key: 'event_date',
    label: 'Date',
    sortable: true,
    filterType: 'daterange',
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    filterType: 'multiselect',
    // Dynamic values derived from unique values present in data
    getValue: (row) => getStatusLabel(row),
  },
  {
    key: 'synced_by',
    label: 'Synced By',
    sortable: true,
    filterType: 'multiselect',
    getValue: (row) => row.synced_by ? usersMap[row.synced_by] || 'Unknown User' : null,
  }
];
```

---

## 4. UI Layers: Popover (Desktop) & Bottom Sheet (Mobile)

### Desktop Layer (≥ 768px)
- **Column Headers**: Each column header includes an interactive button triggering sort toggle on label click, and a funnel filter icon (`FilterIcon`).
- **Filter Popover (`FilterPopover.jsx`)**: Floating glassmorphism card rendered below the column header.
  - **Sort Actions**: Includes `Sort Ascending` and `Sort Descending` buttons at the top of the dropdown menu with custom contextual labels (e.g., "Sort A to Z", "Sort Oldest to Newest").
  - Text input with instant string matching.
  - Date Range inputs (From / To).
  - Multi-select checkbox options populated **dynamically only from values present in current dataset** (avoiding options that return 0 results). Includes an internal search input at the top of the popover to instantly filter the list of checkboxes.
  - Close mechanics: Click-outside backdrop detection or Escape key.

### Mobile Layer (< 768px)
- **Filter / Sort Trigger Button**: Fixed floating or top pill button showing active filter count badges (badge count reflects active column filters only).
- **Bottom Sheet (`FilterSheet`)**: Slide-up drawer attached to bottom of viewport (`max-height: 85vh`).
  - Contains full control set: Sort selector + collapsible Accordions per column filter.
  - Sticky bottom actions: `Clear All` and `Apply Filters`.

### Active Filter Chips Bar
Appears between toolbar and table when 1 or more column filters are active:
- **Architectural Rule**: Sorting is **not** considered a filter and must **not** be displayed as a chip in the active filters bar. Active filter chips and badge counters strictly display active column filters.
- Individual chips displaying `Column: Value` with an `×` remove button.
- Global `Clear All` button.

---

## 6. Row Selection & Floating Bulk Actions

Screens supporting bulk operations include a multi-select checkbox column to the left of the primary column:

### Selection Behavior
- **Master Checkbox (Header)**: Toggles selection on all currently visible (filtered) rows.
- **Row Checkbox**: Toggles selection for individual row IDs.
- **Column Alignment**: The header and row cells for the selection column must both use identical flex alignment (`display: flex; align-items: center; justify-content: flex-start;`) to guarantee pixel-perfect vertical alignment of the checkboxes.

### Floating Bulk Action Bar (`.bulk-action-pill`)
When 1 or more rows are selected, a floating bottom action bar appears containing action buttons (`End`, `Reenable`, `Reset Sync`, `Delete`).

### Forethought Action Enablement Rules
To prevent invalid state transitions across multi-selected items, actions evaluate conditional status rules across **all** currently selected items:

| Bulk Action | Enablement Condition | Disabled Explanation |
|:---|:---|:---|
| **End** | `selectedSessions.every(s => !s.synced_at && !s.ended_at)` | Disabled if ANY selected session is already ended or synced. |
| **Reenable** | `selectedSessions.every(s => !s.synced_at && s.ended_at)` | Disabled if ANY selected session is active or synced. |
| **Reset Sync** | `selectedSessions.every(s => s.synced_at)` | Disabled if ANY selected session is not synced. |
| **Delete** | `selectedSessions.length > 0 && canManage` | Enabled for any non-empty selection (for authorized roles). |

---

## 5. Replication Checklist for Future Screens

When upgrading another page (e.g. `Roster.jsx`) to use this pattern:

- [ ] Import `FilterPopover` and global filter CSS.
- [ ] Define column configs with `key`, `label`, `sortable`, `filterType`, and optional `getValue`.
- [ ] Implement `columnFilters` and `sortConfig` states initialized from `localStorage`.
- [ ] Add `useMemo` filter/sort pipeline: Text matching → Date range evaluation → Multi-select inclusion → Sorting logic.
- [ ] Replace static headers with desktop header controls (`SortableFilterHeader`).
- [ ] Add active filter chips bar under search/toolbar area.
- [ ] Add mobile Filter/Sort trigger button and bottom sheet drawer.
- [ ] Verify persistence across page refreshes.
