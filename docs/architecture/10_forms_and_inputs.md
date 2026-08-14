# Forms and Inputs Architecture

This document standardizes form inputs, date handling, and input component patterns across the application.

---

## 1. Application-Wide Date Standard (`m/d/yy`)

All user-facing date displays and date inputs across the application adhere to the canonical short date format: `m/d/yy` (e.g., `8/9/26`).

### 1.1 Storage vs. Display Format
- **Database Storage**: ISO 8601 strings (`YYYY-MM-DD`, e.g., `2026-08-09`).
- **User Display**: Formatted using `formatAppDate(isoString)` from `src/utils/date.js` (e.g., `8/9/26`).

```javascript
import { formatAppDate } from '../utils/date';

// Usage in grid cell or list:
<span>{formatAppDate(eventObj.event_date)}</span>
```

---

## 2. Reusable `<DateInput />` Component

**File**: `src/components/common/DateInput.jsx`

Because standard browser `<input type="date">` elements enforce locale-specific rendering (such as zero-padded `MM/DD/YYYY`), the application utilizes the `<DateInput />` wrapper component to maintain consistent UX and design:

1. **Display vs. Edit Toggle**:
   - **Blurred state**: Displays a formatted text mask showing `m/d/yy` (e.g. `8/9/26`).
   - **Focused state**: Displays the standard native date selector (`<input type="date">`) and invokes `showPicker()` when clicked.
2. **Theme Integration**:
   - Consumes `useTheme()` to dynamically adjust the input's `color-scheme` property between `dark` and `light`.
   - Ensures the native date picker popover adopts dark background styling when dark mode is enabled and light background styling in light mode.

---

## 3. Form Input Styling Conventions

All inputs share global CSS design tokens defined in `global.css`:
- Background: `var(--bg-secondary)`
- Border: `1px solid var(--border-color)`
- Text Color: `var(--foreground)`
- Border Radius: `var(--radius-sm)`
- Padding: `0.75rem`
- **Text Length Constraints**: Standard text inputs for named entities (e.g., Event Name) enforce a 100-character maximum (`maxLength={100}`) to preserve data integrity and visual alignment.

---

## 4. Custom File Upload Inputs

Standard browser `<input type="file">` controls render unstyled native buttons (`[Choose File] No file chosen`) that conflict with the application's design system.

### 4.1 Custom File Upload Pattern
To ensure a consistent, user-friendly UI across browsers and themes:
1. **Hidden Input**: Hide the native file input (`style={{ display: 'none' }}`) and attach a React `useRef` handle.
2. **Styled Trigger Button**: Use a styled `.btn .btn-secondary` (or primary CTA) button featuring an SVG upload icon to trigger the hidden file input via `fileInputRef.current?.click()`.
3. **Selected Filename Feedback**: Render a adjacent text label displaying the selected file name (`selectedFileName || "No file chosen"`), styled with `var(--text-secondary)` or `var(--foreground)`.
4. **Global CSS Fallback**: `input[type="file"]::file-selector-button` in `global.css` is styled using design tokens (`var(--muted)`, `var(--border-color)`, `var(--radius-sm)`) as a fallback for any unhandled native file inputs.

---

## 5. Independent Form Cards & Responsive Layout Standards

To prevent long monolithic forms and improve usability, settings and user management forms are broken into modular, independent section cards.

### 5.1 Card Structure & Header Standards
Every form section MUST be wrapped in an independent `.glass-card .form-card` block featuring:
- **Card Header**: `.form-card-header` containing a title (`.form-card-title` with SVG icon) and descriptive subtitle (`.form-card-subtitle`).
- **Independent CTAs**: Each card maintains its own submit button (`.form-card-footer`) rather than a single global save action. This provides clear feedback on which section is being updated.

### 5.2 Handling of Read-Only, Disabled & Placeholder States
When displaying fields that cannot be edited by the user (e.g., system email, assigned role permissions, or coming-soon settings):
1. **Read-Only Visual Presentation**: Use read-only/disabled input styling with background `var(--bg-secondary)`, subtle borders, and `cursor: not-allowed`.
2. **Placeholder Notes for Future Features**: For coming-soon functionality placeholders (e.g., role self-demotion, self-deletion, or email updates), display an explicit helper note in red text (`color: 'var(--color-danger, #ef4444)'`) as a clear visual indicator that the field is static and awaiting future feature development.

### 5.3 Vertical Layout Standard for First Name & Last Initial
To prevent users from missing the **Last Initial** input during rapid data entry, First Name and Last Initial fields MUST be arranged vertically in a stacked layout (`flexDirection: 'column'`) across all forms, pages, and modals:
- **First Name Input**: Constrained to a readable maximum width (`maxWidth: 320px`) to prevent full-screen stretching.
- **Last Initial Input**: Rendered directly below First Name with a compact width (`100px`).
- **Scope**: Mandatory pattern across all edit pages (`EditMember.jsx`, `Profile.jsx`) and modal dialogs (`RosterList.jsx` Add Member modal).

### 5.4 Inline Requirements & Validation
- **Required Fields**: Explicitly marked with an asterisk (`<span className="required-asterisk">*</span>`).
- **Password & Security Requirements**: Password forms MUST render an inline requirement callout box (`.password-requirements-box`) near the input fields stating explicit constraints (e.g. minimum character count, password match verification).

### 5.5 Privacy Help Tooltip Standard for Last Initial Fields
To explain our data minimization rationale to users and parents, every **Last Initial** input field across the application MUST include an accessible question mark help tooltip (`<Tooltip />` from `components/common/Tooltip.jsx`) positioned immediately to the right of the compact input:
- **Visual Position**: Positioned inline with the `100px` Last Initial input via flex layout (`alignItems: 'center'`, `gap: '0.5rem'`).
- **Trigger**: `HelpCircle` icon from `lucide-react` wrapped in `.help-tooltip-trigger`.
- **Interaction**:
  - **Click & Tap**: Explicit click-to-toggle opens and closes the popover (preventing hover flicker and ensuring consistent behavior across desktop and mobile/touch). Closes on outside click or `Escape` key.
- **Styling**: Light-grey background (`#f1f5f9` with `--border-color`) in light mode and elevated dark blue-grey (`--bg-elevated`) in dark mode with smooth opacity fade-in.
- **Content Standard**:
  - *"To protect youth privacy and comply with [COPPA guidelines](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), we only collect and store first names and last initials."*
  - The "COPPA guidelines" anchor must open in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).
- **Scope & Rollout**: Prototype established in `RosterList.jsx` (Add Member modal), followed by `EditMember.jsx`, `AcceptInvite.jsx`, `Profile.jsx`, and `Scanner.jsx`.




