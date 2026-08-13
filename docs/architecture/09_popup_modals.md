# Popup Modals Architecture

This document describes the design patterns, layout constraints, and styling conventions for modal dialogs across the application.

---

## 1. Modal Components & CSS Hierarchy

Modals are built using a two-part layout: an overlay container (`.app-modal-overlay`) and the content card (`.app-modal-content`).

```
.app-modal-overlay (backdrop filter, centering)
  └── .app-modal-content (glass card, auto height, max height scroll)
        ├── .app-modal-header / title
        ├── .app-modal-body / content form
        └── footer / action buttons
```

### 1.1 Overlay (`.app-modal-overlay`)
- **Positioning**: Fixed inset (`position: fixed; inset: 0; z-index: 9999;`).
- **Backdrop**: Uses `backdrop-filter: blur(4px);` with `rgba(255, 255, 255, 0.85)` in light mode and `rgba(0, 0, 0, 0.85)` in dark mode.
- **Layout**: Centered with flexbox (`display: flex; align-items: center; justify-content: center;`).

### 1.2 Content Card (`.app-modal-content`)
- **Background**: Standard white (`#ffffff`) in light mode; translucent dark cyan (`rgba(15, 23, 41, 0.95)`) in dark mode.
- **Sizing & Height**:
  - `width: 100%; max-width: 42rem;`
  - `height: auto; min-height: fit-content; max-height: 90vh;`
  - Content automatically scales to fit inside the modal body without leaving excessive whitespace below action buttons.
- **Scrolling**: `overflow-y: auto;` with subtle custom scrollbars in both light and dark themes.
- **Animations**:
  - Entrance: `modalSlideIn` (scale & opacity fade-in over 0.7s with cubic-bezier easing).
  - Exit: `modalSlideOut` (scale & opacity fade-out over 0.7s when `.closing` class is applied).

---

## 2. Reusable Component Pattern (`Modal.jsx`)

**File**: `src/components/common/Modal.jsx` (or inline modal wrappers)

All popups should follow standard accessibility and interaction rules:
1. **Escape key & Overlay click**: Closes the active modal unless explicitly blocked by a pending action/saving state.
2. **Action Buttons**: Placed at the bottom right of the modal body or form with `display: flex; justify-content: flex-end; gap: 0.75rem; marginTop: 1rem;`. Primary positive submit actions use `.btn-primary` or `.btn-start` / `.btn-success` with uppercase labels (e.g., `CREATE EVENT`), while trigger buttons use standard Title Case (e.g., `+ Create Event`). Cancellation uses `.btn-secondary` (`Cancel`).

---

## 3. Global Confirmation & Alert Context (`ConfirmContext.jsx`)

**File**: `src/components/common/ConfirmContext.jsx`  
**Hook**: `useConfirm()`

Application-wide confirm and alert dialogs are managed via `ConfirmProvider` and invoked imperatively via `const confirm = useConfirm()`.

### 3.1 Standard Confirmation Dialog
Returns a Promise resolving to `true` (confirmed) or `false` (canceled):

```javascript
const confirmed = await confirm({
  title: 'Remove Member',
  message: 'Are you sure you want to remove this member from the roster?',
  confirmText: 'Remove',
  cancelText: 'Cancel',
  isDestructive: true
});
```

### 3.2 Single-Button Alert Modal Dialog (`cancelText: null`)
When displaying mandatory notices or user-friendly error dialogs (e.g. duplicate badge scan errors), set `cancelText: null` (or `false`). This hides the cancel button and renders only the primary acknowledgment button:

```javascript
await confirm({
  title: 'Duplicate Badge',
  message: 'This badge is already linked to John D.',
  confirmText: 'OK',
  cancelText: null
});
```

> **Design Standard**: Use `addToast` for transient non-blocking notifications. Use single-button `confirm` alert dialogs (`cancelText: null`) when an error or condition requires explicit user acknowledgment before continuing.

### 3.3 Attendance Status Toggle Confirmation Dialog
When an authorized user toggles a member's attendance status in the event scanner grid, the interaction prompts for explicit confirmation using contextual action labels:

```javascript
const confirmed = await confirm({
  title: isCurrentlySignedOut ? 'Sign Member Back In' : 'Sign Member Out',
  message: isCurrentlySignedOut
    ? `Are you sure you want to sign ${memberName} back in?`
    : `Are you sure you want to sign ${memberName} out?`,
  confirmText: isCurrentlySignedOut ? 'Sign In' : 'Sign Out',
  cancelText: 'Cancel'
});
```

---

## 4. Popover Overlays vs Modal Dialogs

While full dialogs use `.app-modal-overlay` with backdrop blur (`z-index: 9999`), lightweight contextual popovers (such as `FilterPopover.jsx` for table column filtering/sorting) use React Portals (`createPortal(..., document.body)`) positioned fixed relative to their target anchor element (`getBoundingClientRect()`).

### Key Differences
| Element Type | Component | Render Strategy | Z-Index | Clipping & Positioning Behavior |
|:---|:---|:---|:---|:---|
| **Modal Dialog** | `Modal.jsx`, `ConfirmContext.jsx` | Overlay Backdrop Portal (`fixed inset 0`) | `9999` | Centered full viewport dialog with backdrop blur |
| **Filter / Context Popover** | `FilterPopover.jsx` | Target Anchor Portal (`createPortal(..., document.body)`) | `1000` | Positioned fixed to header button; stays unclipped by table container height or `overflow-x: auto` |

For detailed table filter popover implementation standards, see [07_table_patterns.md Section 4](07_table_patterns.md#4-popover-ui-layer--status-badge-synchronization).

---

## 5. Contextual Action Menus & Status Popovers (`.status-popover-menu`)

Compact contextual popovers (such as the event status popover in the Scanner header card) display action items anchored directly to trigger badges or icons.

### 5.1 Structure & Styling
- **Container (`.status-popover-menu`)**: Positioned absolute relative to the trigger cell, featuring a card background (`var(--bg-card)` / dark mode `var(--bg-secondary)`), subtle border, and elevated drop shadow (`box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2)`).
- **Items (`.status-popover-item`)**: Full-width button elements displaying an inline SVG icon and descriptive text.
- **Dismiss Mechanics**: Auto-dismisses when clicking outside the menu container or tapping an action item.

### 5.2 Permission Gating & Disabled Shading Standard
Contextual action popovers MUST NEVER conditionally omit items in a way that renders an empty white container.
- **Visible to All Roles**: All contextual action options remain rendered in the DOM for all user roles.
- **Disabled State**: When a user role (e.g., `badge_scanner`) lacks authorization for an action, the button is rendered with `disabled={true}`, `.status-popover-item:disabled` (`opacity: 0.4; cursor: not-allowed`), and hover effects disabled (`:hover:not(:disabled)`).
- **Descriptive Tooltips**: Provide an informative `title` attribute explaining why the action is disabled (e.g., `"Close unavailable: requires admin role"`, `"Delete unavailable: requires admin role"`).



