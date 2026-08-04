// Full-screen branded loading state.
// Uses .spinner from global.css and CSS vars for colors.
export function AppSpinner() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      background: 'var(--bg-gradient)',
    }}>
      {/* Placeholder logo — bright green square */}
      <div style={{
        width: 40, height: 40,
        background: '#22c55e',
        borderRadius: 'var(--radius-sm)',
      }} />
      <span className="spinner" />
    </div>
  );
}
