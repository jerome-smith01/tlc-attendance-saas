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
      {/* App Logo */}
      <img src="/logo.png" alt="Loading..." style={{ width: 48, height: 48, objectFit: 'contain' }} />
      <span className="spinner" />
    </div>
  );
}
