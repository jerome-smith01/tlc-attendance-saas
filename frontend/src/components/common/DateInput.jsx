import React, { useState, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { formatAppDate } from '../../utils/date';

export function DateInput({
  value,
  onChange,
  required = false,
  style = {},
  className = '',
  ...props
}) {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  const formattedDisplay = value ? formatAppDate(value) : '';
  const currentColorScheme = theme === 'dark' ? 'dark' : 'light';

  const combinedStyle = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--foreground)',
    fontSize: '0.95rem',
    colorScheme: currentColorScheme,
    cursor: 'pointer',
    ...style
  };

  const handleActivate = () => {
    setIsEditing(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        try {
          inputRef.current.showPicker?.();
        } catch (_) {}
      }
    }, 0);
  };

  if (!isEditing) {
    return (
      <input
        type="text"
        readOnly
        value={formattedDisplay}
        placeholder="m/d/yy"
        onClick={handleActivate}
        onFocus={handleActivate}
        required={required}
        style={combinedStyle}
        className={className}
        {...props}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type="date"
      value={value || ''}
      onChange={onChange}
      onBlur={() => setIsEditing(false)}
      required={required}
      style={combinedStyle}
      className={className}
      {...props}
    />
  );
}

export default DateInput;
