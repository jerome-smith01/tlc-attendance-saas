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
| **Scan In / Sign In** | `SCAN IN`, `Sign In` | 🟢 Green | `.scanner-btn-in`, `.btn-signin` | `--color-action-signin` | `#48bb78` / `#10b981` |
| **Scan Out / Sign Out** | `SCAN OUT`, `Sign Out` | 🔵 Blue | `.scanner-btn-out`, `.btn-signout` | `--color-action-signout` | `#4c7cf3` / `#3b82f6` |
| **Reopen** | `Reopen`, `Reopen Event` | 🟢 Green | `.btn-reopen` | `--color-action-start` | `#22c55e` |
| **Close / End** | `Close`, `Close Event` | 🔵 Blue | `.btn-close` | `--color-action-close` | `#0284c7` |
| **Reset Sync** | `Reset Sync`, `Reset Sync Status` | 🟣 Purple | `.btn-reset-sync` | `--color-action-reset` | `#7c3aed` |
| **Delete / Stop** | `Delete`, `DELETE EVENT`, `⏹ Stop Scan` | 🔴 Red | `.btn-destructive`, `.scanner-btn-delete` | `--color-error` | `#ef4444` / `#dc2626` |
| **Cancel / Neutral** | `Deselect All`, `Change` | Neutral | `.btn-secondary`, `.btn-link` | `--muted` | `#e4e4e7` |

### 2.2 Sign In vs. Sign Out Action & Confirmation Dialog Color Standard

- **Green is for Signing In**: All sign-in actions—including the `SCAN IN` mode scanner button, row sign-in toggles, and confirmation dialog CTA buttons labeled `Sign In` when signing a member back in—MUST use green (`.btn-signin` / `.scanner-btn-in`, `--color-action-signin`, `#48bb78`).
- **Blue is for Signing Out**: All sign-out actions—including the `SCAN OUT` mode scanner button, row sign-out toggles, and confirmation dialog CTA buttons labeled `Sign Out` when signing a member out—MUST use blue (`.btn-signout` / `.scanner-btn-out`, `--color-action-signout`, `#4c7cf3`).

### 2.3 Attendance Status Badge Colors

| Status Badge Label | Context | Color Theme | Hex Code |
|:---|:---|:---|:---|
| `SIGNED IN` | Online scan, active sign-in | 🟢 Green | `#10b981` |
| `SIGNED OUT` | Online scan, signed out | 🔵 Blue | `#3b82f6` |
| `SIGNED IN - OFFLINE` | Scan saved offline, active sign-in | 🟡 Yellow | `#eab308` |
| `SIGNED OUT - OFFLINE` | Scan saved offline, signed out | 🟡 Yellow | `#eab308` |

### 2.3 Disabled Button Rules

When any action button is disabled (e.g. invalid bulk selection states):
1. **Never use default grey backgrounds** for active buttons. Active buttons maintain their full brand color.
2. Disabled buttons MUST render with:
   - `opacity: 0.4` (or `0.35` for icon buttons)
   - `cursor: not-allowed`
   - `pointer-events: none` (prevents hover triggers and tooltip flicker)
3. Every button variant (`.btn-primary`, `.btn-secondary`, `.btn-destructive`, `.btn-close`, `.btn-start`, `.btn-reopen`, `.btn-reset-sync`, `.btn-icon-action`, `.scanner-btn-delete`) has an explicit `:disabled` CSS block in `global.css`.

### 2.4 Row Action Icon Buttons

Action icons rendered inside table rows use `.btn-icon-action` combined with the matching action class so their active and deactivated states match the bulk action color tokens:

| Action Purpose | Icon | Active Color | CSS Class | Disabled Behavior |
|:---|:---|:---|:---|:---|
| **Edit** | Pencil Box | ⚪ Light Grey (`#cbd5e1`, dark mode) / Dark Slate (light mode) | `.btn-icon-action.btn-icon-edit` | Faded theme (`opacity: 0.35`) |
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

---

## 4. Scanner Viewfinder Status Colors & Feedback Overlay Standards

To provide instant, unambiguous scan confirmation on mobile devices without cognitive strain, the QR code viewfinder and feedback overlay follow strict color and layout rules.

### 4.1 Viewfinder Corner Brackets

The four viewfinder corner brackets dynamically adapt their border color to reflect the state of the scanner:

| State | Color Theme | Hex Code | CSS Class | Behavior |
|:---|:---|:---|:---|:---|
| **Ready to Scan** | ⚪ White | `#ffffff` | `.scanner-corner-ready` | Default idle and active searching state. |
| **Scanned In** | 🟢 Green | `#10b981` | `.scanner-corner-in` | Active during 2-second success confirmation for Sign-In. |
| **Scanned Out** | 🔵 Blue | `#3b82f6` | `.scanner-corner-out` | Active during 2-second success confirmation for Sign-Out. |
| **Duplicate Scan** | 🟡 Yellow | `#eab308` | `.scanner-corner-duplicate` | Active during 2-second warning confirmation for duplicate scan. |

After 2 seconds, corners automatically revert to `.scanner-corner-ready` (White).

### 4.2 Feedback Overlay Layout & Typography

Instead of showing an isolated icon, scan feedback renders a high-contrast pill container horizontally pairing the status icon with the member's identity:

```
+-------------------------------------------------------------+
|  [ Icon ]   <First Name> <Last Initial>.                    |
+-------------------------------------------------------------+
```

1. **Horizontal Arrangement**: The status icon (TLC logo for success, circular exclamation mark for warning/duplicate) is positioned strictly to the left of the text.
2. **Typography**: Text renders in bold 1.5rem (`.scanner-feedback-name`) with high contrast white text over a dark translucent backdrop (`rgba(15, 23, 42, 0.9)`) and frosted glass blur. This guarantees readability on mobile devices in 2 seconds without squinting.
3. **Format**: Scanned member identities are formatted as `[First Name] [Last Initial].` (e.g., `John D.`).
4. **Unknown Scans**: If a QR badge does not match any registered roster record, the display shows `Member not found`.
5. **Accessibility**: All status changes trigger polite ARIA live region announcements (`[Name] scanned in`, `[Name] scanned out`, `Duplicate scan: [Name]`, `Member not found`).

