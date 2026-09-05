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

## 1.1 Mobile Card Direct Title Header Pattern (`.grid-table-card-header`)

To maximize vertical reading space and accommodate arbitrarily long record names on mobile (< 768px), cards replace separate column labels ("EVENT NAME") with a **Direct Record Title Header** pattern rendered as a clean **Floating Card**:

```
+--------------------------------------------------------+
| [x] Aaron K                                       [🗑️] |
| ------------------------------------------------------ |
| STATUS                                      SIGNED IN  |
| SCANNED IN DATE                                8/12/26 |
| SCANNED IN TIME                               12:47 PM |
| SCANNED IN BY                                Jerome S. |
| SCANNED OUT DATE                                     - |
| SCANNED OUT TIME                                     - |
| SCANNED OUT BY                                       - |
+--------------------------------------------------------+
```

### Mobile Card Architecture
1. **Floating Container (`.grid-table-row`)**:
   - Renders as a distinct floating card with white background (`var(--bg-secondary)`), 12px rounded corners (`border-radius: var(--radius-md, 12px)`), solid border (`1px solid var(--border-color)`), and subtle drop shadow (`box-shadow: 0 2px 6px rgba(0,0,0,0.04)`).
2. **Header Wrapper (`.grid-table-card-header`)**:
   - Combines Cell 1 (Selection Checkbox) and Cell 2 (Record Title Link / Member Name) into a single top flex container (`display: flex; align-items: center; gap: 0.6rem; width: 100%; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.25rem;`).
3. **Top-Aligned Checkbox (`.grid-table-cell-select`)**:
   - Centered vertically on mobile with the title text (`display: flex; align-items: center;`).
4. **Full-Width Title Link (`.event-name-link` / `.member-name-link` / `.grid-table-cell-name`)**:
   - Occupies remaining width (`flex: 1; min-width: 0;`), styled with `text-align: left !important; font-size: 0.95rem; font-weight: 600; line-height: 1.4; word-break: break-word;`. When interactive (e.g. `.member-name-link` navigating to member edit or `.event-name-link` navigating to attendees), renders as an accessible `<button>` turning `var(--color-primary)` with underline on hover/focus.
5. **Clean Field Values (`.grid-table-cell`)**:
   - Field rows (Status, Scan Time, Actions, etc.) render directly against the card's surface without nested grey background boxes or heavy dividers (`padding: 0.4rem 0; border-bottom: none;`).
6. **Desktop Grid Unwrapping (`display: contents`)**:
   - On desktop viewports (`@media (min-width: 768px)`), `.grid-table-card-header` sets `display: contents;`.
   - This eliminates the wrapper from the CSS grid calculation, allowing Cell 1 (checkbox) and Cell 2 (title link) to participate directly in the desktop multi-column CSS grid without DOM duplication.

### Attendance Table Status Badge Contract
Attendance table rows render interactive status pills using the `getDisplayStatus(scan)` and `getStatusBadgeStyle(scan)` helpers:

| Status Label | Condition | Theme / Color | Hex Code |
|:---|:---|:---|:---|
| **`SIGNED IN`** | Online scan, active sign-in (`!raw_sign_out_time`) | 🟢 Green | `#10b981` |
| **`SIGNED OUT`** | Online scan, member signed out (`!!raw_sign_out_time`) | 🔵 Blue | `#3b82f6` |
| **`SIGNED IN - OFFLINE`** | Offline scan (`message === 'Saved Offline'` / `temp-` ID), active sign-in | 🟡 Yellow | `#eab308` |
| **`SIGNED OUT - OFFLINE`** | Offline scan, member signed out | 🟡 Yellow | `#eab308` |

> **Status Toggle Confirmation**: Clicking a status badge prompts for user confirmation (`Sign Member Back In` / `Sign Member Out`) displaying the member's full name before updating Supabase. Authorized roles include `isGlobalAdmin`, `troop_admin`, `billing_admin`, `admin`, and `leader`.

---

## 1.2 Expandable Section Headers (`.attendance-section-header`)

For list sections below the primary Header Card (e.g., the Attendance list), the app uses a sticky/floating section header that acts as an accordion toggle for the table container below it.

### Expandable Header Architecture
1. **Container Alignment**: Uses `display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem;`. It sits directly on the app background (transparent), visually separating the cards from the header.
2. **Left-Aligned Toggle**: An SVG chevron (`polyline points="6 9 12 15 18 9"`) is positioned directly to the left of the section title (`<h3>`).
3. **Interactive Toggle Area**: Both the chevron icon and the section title text are wrapped in a clickable container (`cursor: pointer`, `userSelect: 'none'`) that toggles the `isTableVisible` state.
4. **Animated Chevron**: The SVG chevron rotates dynamically:
   - Expanded: `transform: rotate(0deg)`
   - Collapsed: `transform: rotate(-90deg)`
5. **Right-Aligned Controls**: The right edge of the header accommodates contextual section actions (e.g., the `+ Add Member` button), shifted slightly left (`margin-right: 4px`) to align pixel-perfect with the right edge of the white floating cards below it. **Master selection checkboxes MUST NOT be placed in the section header**; select-all functionality is strictly delegated to the master checkbox in the table's header row (`.grid-table-header-select`).
6. **State Persistence**: Expandable section visibility states (e.g., `isTableVisible`, `isCsvVisible`) MUST be persisted to `localStorage` per user (e.g., `tlc_section_<name>_<userId>`) so section expand/collapse states survive page reloads.

---

## 2. Canonical Filter & Sort State Contract

All screens implementing full Excel-like filtering must manage state adhering to the following structure:

```js
// Sort State
const [sortConfig, setSortConfig] = useState({
  key: null,        // column key (e.g., 'event_name', 'name', 'event_date')
  field: 'first',   // optional sub-field selector for compound columns (e.g. 'first' | 'last' for member name)
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

## 4. Popover UI Layer & Status Badge Synchronization

### Popover Design Standards
- **No Header Bar or Prefix**: Do **not** render a `<div className="filter-popover-header">` header bar or `"Filter "` title prefix. Popovers must be clean, border-less, compact glass-cards.
- **Auto-Dismiss Mechanics**: Popovers close automatically when clicking outside the popover card (backdrop click) or pressing the `Escape` key.
- **Floating React Portal Overlay & Single-Row Height Independence**: Filter popovers MUST be rendered via React Portal (`createPortal(..., document.body)`) using `position: fixed` anchored to the target column header cell's viewport bounding rectangle (`getBoundingClientRect()`). Portaling to `document.body` ensures filter modals float on top of the entire table and page content, preventing popovers from being cut off or clipped by `.grid-table-scroll-wrapper`'s `overflow-x: auto` container bounds or shortened when the table contains only 1 row (or few rows).
- **Viewport Boundary Adjustment**: Popover positioning logic MUST dynamically restrict `left` coordinates within screen boundaries and flip vertically above the header cell if the popover would extend past the bottom viewport edge.
- **Distinct Top Sort Group**: When sorting is supported (`onSort`), render `Sort Ascending` and `Sort Descending` as a distinct, styled top group section (`filter-popover-sort-section`) inside the popover body, separated from filter options by a bottom border line. Provide custom contextual labels (e.g., "Sort A to Z", "Sort Oldest to Newest").
- **Sub-field Sorting (Segmented Control)**: When a column supports multiple sort targets (e.g., `Member Name` sorting by First Name vs Last Initial), pass `sortFields={[{ key: 'first', label: 'First Name' }, { key: 'last', label: 'Last Initial' }]}` along with `activeSortField` and `onSortFieldChange`. Render a segmented toggle (`.filter-popover-sort-segmented` with `.filter-popover-segmented-btn`) directly above the sort direction buttons inside the sort group.
- **Strictly Dynamic Multi-select Options**: Multi-select checkbox options (`type="multiselect"`) MUST be derived dynamically via `useMemo` **strictly from items present in the active dataset** (`events`). Never hardcode option arrays.

### Status Badge Design Token Synchronization
Status badges (`.badge`) MUST share identical color design tokens with their corresponding action buttons to preserve visual cohesion:
- **Closed Badge (`.badge-closed`)**: Uses `var(--color-action-close)` (`#0284c7`) for text, border, and background tint matching the Close action button (`.btn-close` / `.btn-icon-close`).
- **Open / Active Badge (`.badge-success`)**: Uses `var(--color-action-start)` (`#22c55e`).
- **Synced / Complete Badge (`.badge-neutral`)**: Uses `var(--muted-foreground)`.

### Multiselect Default State & Filter Synchronization (`[]` = All Selected)
- **Empty Array Contract**: An empty array (`[]` or falsy) in `columnFilters` represents **"no filter active / all options selected"**.
- **Initial Popover Rendering**: When `FilterPopover` opens and `value` is `[]`, all available checkboxes MUST render as **checked** by default.
- **Auto-Clear to Empty State**: If a user unchecks items and later re-checks all options, `FilterPopover` MUST set the filter value back to `[]`.
- **Icon & Chip Visibility**: The active filter indicator (` 🌪️`) and active filter chip MUST only appear when a column filter is actively restricting items (`value.length > 0`). When all items are selected or no filter is applied, the filter icon and active chip MUST disappear.

### Cross-Column Inter-Filter Dependency & "Hidden:" Section
- **Inter-Filter Option Availability**: Options inside a column's `FilterPopover` must dynamically reflect filters applied across **other** columns.
- **Calculating Available Values**: To determine whether an option is active for column $C$, evaluate the dataset filtered by all active criteria **EXCEPT** column $C$'s own filter (e.g. `getFilteredEvents(excludeColumn)`).
- **"Hidden:" Section for Inactive Options**:
  - Options unavailable due to filters in other columns are marked `disabled: true`.
  - Inactive/disabled options MUST be partitioned to the bottom of the popover option list beneath a separate `<label>` header:
    ```jsx
    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', marginTop: '0.5rem', marginBottom: '0.35rem' }}>
      Hidden:
    </label>
    ```
  - Items in the `Hidden:` section render with reduced opacity (`opacity: 0.5`), a `cursor: not-allowed` indicator, and a disabled input (`disabled={true}`).

### Active Filter Chips Bar
Appears between toolbar and table when 1 or more column filters are active:
- **Architectural Rule**: Sorting is **not** considered a filter and must **not** be displayed as a chip in the active filters bar. Active filter chips and badge counters strictly display active column filters.
- **Exact Header Naming**: Chips MUST use the exact text of the column header as their label prefix (`Event Name: ...`, `Date: ...`, `Status: ...`, `Synced By: ...`, `Actions: ...`). Do **not** use shorthand or nested prefixes (e.g., avoid `Date: Dates:`).
- **String Truncation & Summarization**:
  - If more than 2 items are selected in a multiselect filter, summarize as `X selected` (e.g. `Event Name: 3 selected`).
  - Individual item strings longer than 50 characters MUST be truncated with an ellipsis (`...`).
- Individual chips display an `×` remove button to clear that specific column filter.
- Global `Clear All` button resets filters, sort state, and global search text.

---

## 5. Desktop Container Width Stability & Fixed Grid Tracks

To prevent layout jumping and width collapse when filtering table records or displaying rows with varying text lengths, tables MUST follow strict container width and CSS grid rules:

### 5.1 Full Width Container Enforcement (`width: 100%`)
- **Outer Wrapper & Glass Card**: The page outer wrapper (see [05_frontend_patterns.md Section 5.3](05_frontend_patterns.md#53-page-outer-wrapper-maxwidth-1400px) for the canonical `maxWidth: '1400px'` page container standard), `.glass-card`, `.grid-table-container`, `.grid-table-header`, `.grid-table-row`, and `.layout-main` MUST explicitly set `width: 100%` and `box-sizing: border-box`.
- **No Shrink Collapse**: Tables must **NEVER** shrink or collapse horizontally when filtering narrows the dataset or removes long text rows. The table card and grid container must permanently remain at maximum container width on desktop.

### 5.2 Strict `minmax(0, ...)` Grid Track Definitions
- **No Implicit `auto` Min-Content Sizes**: On desktop (`@media (min-width: 768px)`), `grid-template-columns` MUST use `minmax(0, ...)` for all fractional (`fr`) tracks (e.g. `grid-template-columns: 48px minmax(0, 2.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr)`).
- **Why**: Plain `1.5fr` evaluates to `minmax(auto, 1.5fr)`. The `auto` minimum content size forces grid columns to expand when long text rows exist and shrink when filtered out. Using `minmax(0, ...)` ensures column widths remain 100% fixed and predictable regardless of content length.
- **Cell Shrinkage & Text Wrapping**: `.grid-table-cell` MUST include `min-width: 0`, `overflow-wrap: break-word`, and `word-break: break-word` so cell contents wrap cleanly without stretching grid tracks.

### 5.3 Resizable Column Widths & LocalStorage Persistence
To allow users to adjust column widths according to their viewing preferences without breaking container layouts:

- **Interactive Resizer Handle (`.column-resizer`)**:
  - Render a `.column-resizer` handle element at the right edge of each resizable header cell (except the last column).
  - Uses `position: absolute; top: 0; right: -4px; width: 9px; height: 100%; cursor: col-resize; z-index: 10;`.
  - Displays a subtle border line handle (`::after`) that highlights primary accent color on hover or drag.
- **Fixed Total Width & Sum-Preserving FR Adjustments**:
  - Store column widths as fractional ratio weights (`fr`) (e.g. `{ event_name: 2.5, event_date: 1.0, status: 1.0, synced_by: 1.0, actions: 1.3 }`).
  - When dragging the handle between Column $A$ (left) and Column $B$ (right), calculate pixel drag delta and convert to FR weight delta:
    $$\Delta\text{fr} = \frac{\Delta x}{\text{availableContainerWidth}} \times \text{totalFr}$$
    $$\text{newLeftFr} = \max(\text{minFr}, \text{startLeftFr} + \Delta\text{fr})$$
    $$\text{newRightFr} = \max(\text{minFr}, \text{startRightFr} - (\text{newLeftFr} - \text{startLeftFr}))$$
  - Because Column $A$ gains exactly what Column $B$ loses ($\Delta\text{fr}_A + \Delta\text{fr}_B = 0$), the total FR sum remains constant, keeping the total table width **100% consistent at all times** with zero container overflow.
  - Enforce a minimum column width (`minFr = 0.4`) to prevent columns from collapsing.
- **Hooks Declaration Order & TDZ Safety**:
  - Role check variables like `canManage` determine active columns.
  - **CRITICAL**: Always declare `canManage` BEFORE dependent hooks (`gridTemplateStyle` and `handleStartResize`). Placing hooks above `canManage` causes Temporal Dead Zone (`Uncaught ReferenceError: Cannot access 'canManage' before initialization`) runtime crashes.
- **LocalStorage Persistence**:
  - Persist `columnWidths` in `localStorage` alongside filters/sort state under `tlc_events_filters_${userId}` (or `tlc_datatable_${storageKey}_${userId}`).
- **Replication in `DataTable.jsx` (HTML `<table>`)**:
  - Apply `table-layout: fixed; width: 100%;` to `<table>`.
  - Render `<colgroup>` with `<col style={{ width: '${columnWidths[key]}fr' }} />` to control column width allocations.

### 5.4 Responsive Scroll Wrapper (`.grid-table-scroll-wrapper`) & Mobile Viewport Collapse
To handle tables with many columns (e.g. Scanner Attendance Table with 9 columns) without squishing desktop grid cells or breaking mobile card layouts:

- **Desktop Viewports (`@media (min-width: 768px)`)**:
  - `.grid-table-scroll-wrapper` sets `overflow-x: auto; width: 100%`.
  - `.grid-table-scroll-wrapper > .grid-table-container` sets `min-width: 1100px` (or screen-appropriate minimum width).
  - Enables smooth horizontal scrolling for wide desktop grid tables while maintaining fixed fractional column ratios (`fr`) and pixel resizers.
- **Mobile Viewports (< 768px)**:
  - `.grid-table-container` remains `width: 100%` without a `min-width` restriction.
  - Cards (`.grid-table-row`) collapse to 100% of the mobile screen width with `display: flex; flex-direction: column;`.
  - Field cells (`.grid-table-cell`) display labels on the left and values on the right edge of the mobile screen without label/value separation or forced horizontal page scrolling.

---

## 5.5 Attendance Table 6-Column Scan Specification

The Scanner attendance table (`Scanner.jsx`) replaces the legacy single combined "Scan Time" column with **6 individual, filterable, and sortable columns**:

| Column Key | Column Header | Data Source & Formatting | Empty Value Fallback |
|:---|:---|:---|:---|
| `in_date` | `Scanned in date` | `raw_sign_in_time` formatted via `formatAppDate()` (e.g. `8/12/26`) | `-` |
| `in_time` | `Scanned in time` | `raw_sign_in_time` formatted via `toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })` | `-` |
| `in_by` | `Scanned in by` | Looked up from `roster` state by `signed_in_by` UUID, formatted as `First L.` (e.g. `Jerome S.`) | `-` |
| `out_date` | `Scanned out date` | `raw_sign_out_time` formatted via `formatAppDate()` | `-` |
| `out_time` | `Scanned out time` | `raw_sign_out_time` formatted via `toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })` | `-` |
| `out_by` | `Scanned out by` | Looked up from `roster` state by `signed_out_by` UUID, formatted as `First L.` | `-` |

### Real-Time Scanner State Synchronization
When new scans arrive real-time (`processPayload`, `handleResolveUnknown`, `handleManualAddAttendee`), state updates MUST construct all 6 properties immediately (`raw_sign_in_time`, `raw_sign_out_time`, `in_date`, `in_time`, `in_by`, `out_date`, `out_time`, `out_by`) so new scan rows render live without requiring a page refresh.

### Expiration Date Sorting & Filtering (`membership_exp`)
The `Expiration Date` column on the Roster table (`RosterList.jsx`) supports Excel-like sorting and multi-select filtering via `FilterPopover`:
1. **Date Comparison**: Uses the `compareExpirationDate` utility (`frontend/src/utils/dateSorter.js`). Supports sorting by **Earliest First** (`asc`) and **Latest First** (`desc`).
2. **Null / Missing Expiration Dates**: Members with no expiration date on file (`null` or empty) are grouped at the bottom of the table list in both ascending and descending sort directions.
3. **Multi-Select Filter Options**: Dynamically presents unique formatted expiration dates (`m/d/yyyy` or `No Expiration`).
4. **Header Status Indicators**: Displays active sort arrows (`↑` / `↓`) and filter funnel icons (`🌪️`) inside the header button label.

---

## 6. Row Selection & Pixel-Perfect Alignment

Screens supporting bulk operations include a multi-select checkbox column to the left of the primary data column:

### Selection Behavior & Alignment
- **Master Checkbox (Header Row Only)**: Toggles selection on all currently visible (filtered) rows. Uses `input.indeterminate = isSomeSelected` for partial selection. The master select-all checkbox is strictly placed in the table header row (`.grid-table-header-select` / Cell 1), NEVER outside in the upper-right section header or card controls.
- **Row Checkbox**: Toggles selection for individual row IDs.
- **Pixel-Perfect Alignment**: Both the header selection cell (`.grid-table-header-select`) and row selection cell (`.grid-table-cell-select`) MUST use identical padding and flex alignment (`display: flex; align-items: flex-start; justify-content: flex-start; padding-left: 1rem; width: 48px;`) on desktop.
- **Top Vertical Row Alignment**: On desktop (`@media (min-width: 768px)`), `.grid-table-row` MUST specify `align-items: flex-start;` and consistent `line-height: 1.4;` so all cells in the row align to the top. Record title buttons (`.event-name-link`) use `display: block; margin: 0; padding: 0; line-height: 1.4;` to ensure their text baseline matches adjacent cells perfectly without UA button padding or line box offsets.
- **Mobile Alignment**: On mobile cards (< 768px), `.grid-table-cell-select` uses `margin-top: 2px` to align the top edge of the checkbox flush with the first line of the title text.

---

## 6.1 Temporary Row Highlight Animation (`.newly-scanned`)

When a record is scanned or newly added/updated in a table (e.g., scanning attendance in `/scanner` or linking a member badge in `/roster`), the corresponding row MUST be temporarily highlighted with a subtle success background color tint that smoothly fades away over 2.5 seconds.

### Implementation Standard
1. **CSS Keyframe Animation (`global.css`)**:
   ```css
   @keyframes scanRowHighlight {
     0% { background-color: color-mix(in srgb, var(--color-success) 35%, transparent); }
     100% { background-color: transparent; }
   }

   .grid-table-row.newly-scanned {
     animation: scanRowHighlight 2.5s ease-out forwards;
   }
   ```
2. **DOM ID & Class Assignment**:
   - Give row elements an explicit ID: `id={`scan-row-${record.id}`}`.
   - Conditionally append `.newly-scanned`: `className={`grid-table-row ${recentlyScannedIds.has(record.id) ? 'newly-scanned' : ''}`}`.
3. **Trigger Function**:
   - Manage a `recentlyScannedIds` set state in the parent table component.
   - Call `triggerRowHighlight(recordId)` upon successful scan or badge link to temporarily add the ID for 2500ms before auto-removing it.

---

## 7. Single-Row Action Column Rules

### Layout & DOM Placement (CRITICAL)
- **End of DOM Placement**: The `Actions` cell MUST be placed at the very end of the row's DOM structure (i.e. as the last child of `.grid-table-row`). Do **NOT** place the Actions cell inside `.grid-table-card-header`. Because the header uses `display: contents` on desktop, placing Actions inside it will preserve DOM order and cause the Actions cell to render prematurely in the 3rd grid column, shifting all other values to the right.
- **Left-Aligned Action Cell**: Row action cells MUST align to the left (`justifyContent: 'flex-start'`) directly beneath the left-aligned `Actions` header text.
- **No Separate "View Attendees" Action Button**: Do **not** render a separate "View Attendees" button in the single-row action cell. The primary record name link (e.g., Event Name) serves as the single mechanism to open attendee detail modals.

### 7.1 Profile Column & Action Chips ("View" / "Scan Badge")

For member roster views, the **Profile** column displays the status of a member's Trail Life Connect profile link via actionable badge chips:

- **Linked Profile ("View")**:
  - Rendered as a green `badge-success` chip.
  - Acts as an external hyperlink (`<a target="_blank" href="https://www.traillifeconnect.com/profile/${tlc_id}/overview">View</a>`).
  - Opens the member's profile directly on Trail Life Connect in a new tab.
- **Unlinked Profile ("Scan Badge")**:
  - Rendered as a grey `badge-neutral` chip.
  - Acts as an interactive button for authorized roles (`canManageRoster`), triggering `SingleBadgeScannerModal` for targeted badge scanning.
  - Non-authorized roles see a light/disabled indicator.
- **Scanning & Conflict Handling**:
  - Scanning a badge parses `memberId | tlcId` and updates `roster.tlc_id` and `roster.member_id` in Supabase and local state.
  - Triggers temporary green row highlight (`.newly-scanned`).
  - If the scanned `tlc_id` is already assigned to another member in the troop (`Postgres 23505`), the application displays an imperative single-button alert modal (`confirm({ title: 'Duplicate Badge', message: '...', confirmText: 'OK', cancelText: null })`) naming the conflicting member.

### 7.2 Attendance Status Column & Interactive Badge Toggle

For event attendance views (`/events/[event-id]`):
- **Status Badges (`.badge`)**: Rendered as interactive buttons for authorized roles (`isGlobalAdmin`, `troop_admin`, `billing_admin`, `admin`, `leader`).
- **Interactive Toggle & Confirmation**: Tapping the status badge switches between **SIGNED OUT** (`complete`) and **SIGNED IN** (`pending`). Before performing the database update, the interaction triggers a standard confirmation modal (`confirm(...)`):
  - **Signed Out -> Sign In**: Title `"Sign Member Back In"`, Message `"Are you sure you want to sign [Member Name] back in?"`, Confirm button `"Sign In"`.
  - **Signed In -> Sign Out**: Title `"Sign Member Out"`, Message `"Are you sure you want to sign [Member Name] out?"`, Confirm button `"Sign Out"`.
- **Role Permission Scoping**: Permission checks (`canToggle`) must explicitly evaluate all administrative roles (`isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin' || currentUserRole === 'admin' || currentUserRole === 'leader'`) to prevent silent early exits.


### Standardized Action Icon Button Classes (`.btn-icon-action`)
Single-row action buttons MUST use global CSS utility classes rather than ad-hoc inline styles:
- Base class: `.btn-icon-action` (flex centered, 6px padding, `var(--radius-sm)`, border, pointer cursor, smooth transitions).
- Action-specific modifier classes:
  - `.btn-icon-edit` (Theme-adaptive edit styling: white in dark mode, dark slate in light mode)
  - `.btn-icon-close` (Blue accent styling for closing an item)
  - `.btn-icon-reopen` (Green accent styling for reopening an item)
  - `.btn-icon-reset-sync` (Purple accent styling for resetting sync status)
  - `.btn-icon-destructive` (Red accent styling for deleting an item)

### Monochrome Theme-Adaptive SVG Icons
- Action buttons MUST use standardized inline SVG stroke icons with `stroke="currentColor"` (avoid colorful emoji buttons like 🔒 or 🗑️).
- Color accents applied via CSS borders and subtle hover background tints.

### Always Present & Shaded Grey when Unavailable
- All single-row action icons (Close, Reopen, Reset Sync, Delete) MUST remain present in the DOM for all rows (never conditionally hide them).
- When an action is **available** for a given row:
  - Button is enabled (`disabled={false}`) with full opacity and interactive hover state.
- When an action is **unavailable** for a given row:
  - Button is disabled (`disabled={true}`) with `opacity: 0.35` and `cursor: 'not-allowed'`.
  - Provide a clear, descriptive tooltip (`title`) explaining why the action is unavailable (e.g., *"Close unavailable: event is already closed or synced"*).

---

## 8. Floating Bulk Action Bar (`.bulk-action-pill`) & Action Guide

When 1 or more rows are selected via checkboxes, a floating bottom action bar (`.bulk-action-pill`) appears centered above the bottom viewport edge.

### High-Contrast Floating Pill Theme
- Uses high-contrast surface styling (`#334155` background in light mode, `#f1f5f9` in dark mode) with elevated drop shadow (`0 14px 35px rgba(0,0,0,0.45)`).
- Action icon buttons in the floating bar use standard design tokens (`var(--color-action-close)`, `var(--color-action-start)`, `var(--color-action-reset)`, `var(--color-destructive)`).

### Help Icon & Interactive Action Guide Popover
- Includes a circular Help `?` button (`.btn-icon-help`) with `border: none; background: transparent;` rendering a single SVG circle around the question mark.
- Tapping `?` opens an `.action-guide-popover` card displaying an "ACTION GUIDE" legend detailing all available bulk action icon meanings and labels.

### Forethought Action Enablement Rules
To prevent invalid state transitions across multi-selected items, bulk actions evaluate conditional status rules across **all** currently selected items:

| Bulk Action | Enablement Condition | Disabled Explanation |
|:---|:---|:---|
| **Close** | `selectedItems.every(s => !s.synced_at && !s.ended_at)` | Disabled if ANY selected item is already ended or synced. |
| **Reopen** | `selectedItems.every(s => !s.synced_at && s.ended_at)` | Disabled if ANY selected item is active or synced. |
| **Reset Sync** | `selectedItems.every(s => s.synced_at)` | Disabled if ANY selected item is not synced. |
| **Delete** | `selectedItems.length > 0 && canManage` | Enabled for any non-empty selection (for authorized roles). |

---

## 9. Replication Checklist for Future Screens

When building or upgrading another page (e.g. `Roster.jsx`) to use this pattern:

- [ ] Import `FilterPopover` (uses React Portal `createPortal` with fixed viewport coordinates so popovers float unclipped over single-row tables) and global filter CSS.
- [ ] Implement `columnFilters` and `sortConfig` states initialized from `localStorage` (`tlc_table_<screen>_<userId>`).
- [ ] Implement `columnWidths` state initialized from `localStorage` with `defaultColumnWidths`.
- [ ] Add `.column-resizer` handles to header cells (with `onMouseDown` triggering `handleStartResize`).
- [ ] Implement sum-preserving FR drag resizing (`handleStartResize`) with `minFr` limits so total table width stays fixed at 100%.
- [ ] Ensure `canManage` (or role checks) is declared BEFORE `gridTemplateStyle` and `handleStartResize` hooks to prevent TDZ errors.
- [ ] Use `selectedTroop?.currentUserRole` for permission checks (`canManage`).
- [ ] Wrap top mobile selection cell and record title cell in `.grid-table-card-header` using `align-items: flex-start; gap: 0.6rem;` on mobile and `display: contents;` on desktop.
- [ ] **CRITICAL**: Place the `Actions` cell at the very end of the `.grid-table-row` DOM, outside of `.grid-table-card-header`. Placing it inside the header causes desktop grid misalignment due to `display: contents`.
- [ ] Set `margin-top: 2px` on `.grid-table-cell-select` for mobile so the top border of the checkbox box aligns with the top of the first title text line.
- [ ] Remove standalone "Event Name" label text on mobile cards, placing the event title value link directly next to the checkbox.
- [ ] Match status badge color tokens to action button tokens (`.badge-closed` uses `var(--color-action-close)` `#0284c7`).
- [ ] Enforce `width: 100%` and `box-sizing: border-box` on outer page wrapper, `.glass-card`, `.grid-table-container`, header, and row elements so table width never shrinks when filtering.
- [ ] Use `minmax(0, ...)` tracks for all fractional columns in `grid-template-columns` and `min-width: 0` on `.grid-table-cell` to guarantee column width stability.
- [ ] Define dynamic `useMemo` options for column filters derived strictly from current dataset items (including `uniqueDates` for date columns).
- [ ] Implement `getFilteredEvents(excludeColumn)` to compute cross-column available options (`availableEventNames`, `availableDates`, etc.).
- [ ] Pass `disabled: !availableSet.has(val)` to `FilterPopover` options so unavailable options are placed at the bottom under a `Hidden:` header section.
- [ ] Ensure empty filter array `[]` represents "no filter active", displaying all checkboxes checked in `FilterPopover` and hiding the ` 🌪️` icon and chip.
- [ ] Format active filter chips using exact column header names (`Event Name:`, `Date:`, `Actions:`), summarizing `> 2` items as `X selected` and truncating strings `> 50` chars.
- [ ] Support Date Range (`From`/`To` + presets + `showPicker`) as well as dynamic multi-select specific dates in date popovers.
- [ ] Bind column title buttons to toggle popovers (remove standalone funnel buttons).
- [ ] Display ` 🌪️` for active filters and ` ↑` / ` ↓` for active sort direction inside title buttons (no ` ↕` for unsorted).
- [ ] Left-align `Actions` header and row action cells (`justifyContent: 'flex-start'`).
- [ ] Exclude sorting controls from `Actions` popover.
- [ ] Ensure selection header and row selection cells use identical `padding-left: 1rem` alignment on desktop.
- [ ] Use `.btn-icon-action` with contextual modifier classes (`.btn-icon-close`, `.btn-icon-reopen`, `.btn-icon-reset-sync`, `.btn-icon-destructive`) and inline SVG stroke icons (`stroke="currentColor"`).
- [ ] Keep all row actions present in DOM; shade unavailable actions grey (`opacity: 0.35`, `disabled={true}`) with tooltips.
- [ ] Use record title links for detail modals (remove redundant "View" action buttons).
- [ ] Include high-contrast `.bulk-action-pill` with `?` help button (`.btn-icon-help`) and interactive Action Guide popover card.
- [ ] Add active filter chips bar under toolbar area.
- [ ] Add mobile Filter/Sort trigger button and bottom sheet drawer.
- [ ] For nested list sections, use `.attendance-section-header` pattern with left-aligned chevron toggle and right-aligned action buttons (e.g. `+ Add Member`). Never place a master select-all checkbox in the section header; keep master selection strictly inside the table header row (`.grid-table-header-select`).
- [ ] Implement temporary green row highlight animation (`.newly-scanned` / `scanRowHighlight`) when scanning or updating table records.






