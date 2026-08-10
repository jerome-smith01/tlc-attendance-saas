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

## 3. Icon & Logo System Architecture

### 3.1 App Logo Standard (`/logo.png`)
The application logo is stored as a transparent PNG asset at `frontend/public/logo.png`. It is used consistently across all app touchpoints:

| Location | Component | Sizing / Styling | Notes |
|:---|:---|:---|:---|
| **Top Header Bar** | `SidebarLayout.jsx` | 32x32px, `object-fit: contain` | Positioned alongside the "TLC Attendance" app title in the full-width header. |
| **Scan Success Overlay** | `Scanner.jsx` & `SingleBadgeScannerModal.jsx` | `width: 36%`, `height: 36%`, `object-fit: contain` | Rendered centered over live camera feed inside `.scan-overlay--success`, constrained to fit neatly inside the green scanner brackets. |
| **Login Screen** | `Login.jsx` | 48x48px, `object-fit: contain` | Replaces placeholder squares above sign-in form. |
| **App Loading State** | `AppSpinner.jsx` | 48x48px, `object-fit: contain` | Displayed above loading spinner during auth boot. |
| **Favicon** | `index.html` | `<link rel="icon" type="image/png" href="/logo.png" />` | Displayed as the browser tab icon. |

### 3.2 Icon Conventions
- Use Lucide icons for all icons across the application.
- All SVG icons inherit text color via `stroke="currentColor"` or `fill="currentColor"`.

---

## 4. Bulk Action Pill Implementation Guide

The `.bulk-action-pill` floating widget provides bulk management capabilities in a compact, floating toolbar fixed at the bottom center of the viewport. On mobile viewports it renders icon-only action buttons to save screen real estate, and displays text labels on desktop viewports via `.bulk-action-btn-text`.

Any screen implementing bulk selection MUST use:

```jsx
<div className="bulk-action-pill">
  {/* Left Side: Count, Label & Clear */}
  <div className="bulk-action-pill-info">
    <span className="bulk-action-pill-count">{selectedCount}</span>
    <span className="bulk-action-pill-label">Selected</span>
    <button
      type="button"
      className="btn-icon-action btn-icon-clear"
      onClick={clearSelection}
      title="Clear selection"
    >
      <XIcon width="16" height="16" />
    </button>
  </div>

  {/* Vertical Divider */}
  <div className="bulk-action-pill-divider" />

  {/* Right Side: Action Buttons */}
  <div className="bulk-action-pill-actions">
    <button
      type="button"
      className="btn-icon-action btn-icon-close"
      disabled={!canBulkClose}
      onClick={handleBulkClose}
      title={...}
    >
      <LockIcon width="18" height="18" />
      <span className="bulk-action-btn-text">Close</span>
    </button>
    
    <button
      type="button"
      className="btn-icon-action btn-icon-reopen"
      disabled={!canBulkReopen}
      onClick={handleBulkReopen}
      title={...}
    >
      <UnlockIcon width="18" height="18" />
      <span className="bulk-action-btn-text">Reopen</span>
    </button>
    
    <button
      type="button"
      className="btn-icon-action btn-icon-reset-sync"
      disabled={!canBulkResetSync}
      onClick={handleBulkResetSync}
      title={...}
    >
      <ResetIcon width="18" height="18" />
      <span className="bulk-action-btn-text">Reset Sync</span>
    </button>
    
    <button
      type="button"
      className="btn-icon-action btn-icon-destructive"
      onClick={handleBulkDelete}
      title="Delete selected items"
    >
      <TrashIcon width="18" height="18" />
      <span className="bulk-action-btn-text">Delete</span>
    </button>
  </div>
</div>
```
