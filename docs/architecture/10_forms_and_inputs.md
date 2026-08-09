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
