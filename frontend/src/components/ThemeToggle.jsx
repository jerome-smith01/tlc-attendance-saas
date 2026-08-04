import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'none',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-pill)',
        padding: '6px 10px',
        cursor: 'pointer',
        color: 'var(--foreground)',
        fontSize: '1rem',
        transition: 'all var(--transition-fast)',
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
