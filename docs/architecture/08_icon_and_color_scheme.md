# Architectural Pattern 08: Icon and Color Scheme Architecture

This document establishes the official design system standards for icons, color tokens, and action buttons across the TLC Attendance SaaS application. The `/events` (formerly `/sessions`) screen serves as the **prototype implementation** for these standards.

---

## 1. Color System Architecture

All application colors are managed through CSS custom properties in `frontend/src/styles/global.css`. Hardcoded hex codes in JSX files are prohibited.

### 1.1 Base & Theme Tokens

| Token | Light Value | Dark Value | Usage |
|:---|:---|:---|:---|
| `--background` | `#f4f4f5` | `#0f172a` | Main background color |
| `--foreground` | `#0f172a` | `#f8fafc` | Default body text color |
| `--muted` | `#e4e4e7` | `#1e293b` | Muted container / secondary background |
| `--muted-foreground` | `#475569` | `#94a3b8` | Subtitle / placeholder text |
| `--color-primary` | `#0284c7` (sky-600) | `#38bdf8` (sky-400) | Brand primary color, default CTA |
| `--color-primary-hover` | `#0369a1` | `#7dd3fc` | Hover state for primary |
| `--color-secondary` | `#64748b` | `#94a3b8` | Secondary neutral element color |
| `--color-success` | `#22c55e` | `#22c55e` | Success states, scan green |
| `--color-error` | `#ef4444` | `#ef4444` | Errors, destructive actions |
| `--color-warning` | `#f59e0b` | `#f59e0b` | Warnings, pending states |

---

## 2. Action Button Color Mapping & Semantic Classes

To ensure visual clarity and consistency across screens and bulk-action bars, action buttons follow a standardized semantic color scheme.

### 2.1 Action Button Standards

| Action Purpose | Button Label Examples | Color Theme | CSS Class | Color Token | Hex Code |
|:---|:---|:---|:---|:---|:---|
| **Start / Create** | `+ Start New Event`, `Start Scan` | 🟢 Green | `.btn-start` | `--color-action-start` | `#22c55e` |
| **Reopen** | `Reopen`, `Reopen Event` | 🟢 Green | `.btn-reopen` | `--color-action-start` | `#22c55e` |
| **Close / End** | `Close`, `Close Event` | 🔵 Blue | `.btn-close` | `--color-action-close` | `#0284c7` |
| **Reset Sync** | `Reset Sync`, `Reset Sync Status` | 🟣 Purple | `.btn-reset-sync` | `--color-action-reset` | `#7c3aed` |
| **Delete / Stop** | `Delete`, `⏹ Stop Scan` | 🔴 Red | `.btn-destructive` | `--color-error` | `#ef4444` |
| **Cancel / Neutral** | `Deselect All`, `Change` | Neutral | `.btn-secondary`, `.btn-link` | `--muted` | `#e4e4e7` |

### 2.2 Disabled Button Rules

When any action button is disabled (e.g. invalid bulk selection states):
1. **Never use default grey backgrounds** for active buttons. Active buttons maintain their full brand color.
2. Disabled buttons MUST render with:
   - `opacity: 0.4` (or `0.35` for icon buttons)
   - `cursor: not-allowed`
   - `pointer-events: none` (prevents hover triggers and tooltip flicker)
3. Every button variant (`.btn-primary`, `.btn-secondary`, `.btn-destructive`, `.btn-close`, `.btn-start`, `.btn-reopen`, `.btn-reset-sync`, `.btn-icon-action`) has an explicit `:disabled` CSS block in `global.css`.

### 2.3 Row Action Icon Buttons

Action icons rendered inside table rows use `.btn-icon-action` combined with the matching action class so their active and deactivated states match the bulk action color tokens:

| Action Purpose | Icon | Active Color | CSS Class | Disabled Behavior |
|:---|:---|:---|:---|:---|
| **Close** | Lock Closed | 🔵 Blue | `.btn-icon-action.btn-icon-close` | Faded blue theme (`opacity: 0.35`) |
| **Reopen** | Lock Open | 🟢 Green | `.btn-icon-action.btn-icon-reopen` | Faded green theme (`opacity: 0.35`) |
| **Reset Sync** | Rotate Arrow | 🟣 Purple | `.btn-icon-action.btn-icon-reset-sync` | Faded purple theme (`opacity: 0.35`) |
| **Delete** | Trash Can | 🔴 Red | `.btn-icon-action.btn-icon-destructive` | Faded red theme (`opacity: 0.35`) |

---

## 3. Icon System Architecture

### 3.1 Icon Conventions
- Action buttons may include leading emoji or SVG icons for quick scanning (e.g., `+`, `📷`, `⏹`, `📁`, `✏️`).
- Icon-only or inline decorative icons use inline SVG or standard Unicode icons.
- All SVG icons inherit text color via `stroke="currentColor"` or `fill="currentColor"`.

---

## 4. Bulk Action Pill Implementation Guide

The `.bulk-action-pill` floating widget provides bulk management capabilities. Any screen implementing bulk selection MUST use:

```jsx
<div className="bulk-action-pill">
  <span>{selectedCount} item{selectedCount > 1 ? 's' : ''} selected</span>
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    {/* Blue Close Button */}
    <button className="btn btn-close" disabled={!canBulkClose} onClick={handleBulkClose}>
      Close
    </button>
    
    {/* Green Reopen Button */}
    <button className="btn btn-reopen" disabled={!canBulkReopen} onClick={handleBulkReopen}>
      Reopen
    </button>
    
    {/* Purple Reset Sync Button */}
    <button className="btn btn-reset-sync" disabled={!canBulkResetSync} onClick={handleBulkResetSync}>
      Reset Sync
    </button>
    
    {/* Red Delete Button */}
    <button className="btn btn-destructive" onClick={handleBulkDelete}>
      Delete
    </button>
    
    {/* Deselect */}
    <button className="btn-link" onClick={clearSelection}>
      Deselect All
    </button>
  </div>
</div>
```
