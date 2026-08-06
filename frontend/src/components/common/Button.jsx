import React from 'react';

export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  isLoading = false,
  isDisabled = false,
  icon = null,
  className = '',
  style = {},
  ...props
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: 'var(--color-secondary)',
          color: '#ffffff',
          border: 'none',
        };
      case 'destructive':
        return {
          backgroundColor: 'var(--color-destructive)',
          color: '#ffffff',
          border: 'none',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--foreground)',
          border: '1px solid var(--border-color)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--foreground)',
          border: 'none',
          boxShadow: 'none',
        };
      case 'primary':
      default:
        return {
          backgroundColor: 'var(--color-primary)',
          color: '#ffffff',
          border: 'none',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '0.4rem 0.8rem', fontSize: '0.8rem' };
      case 'lg':
        return { padding: '0.875rem 1.75rem', fontSize: '1rem' };
      case 'md':
      default:
        return { padding: '0.625rem 1.25rem', fontSize: '0.875rem' };
    }
  };

  const baseStyle = {
    display: 'inline-flex',
    align-items: 'center',
    justify-content: 'center',
    gap: '0.5rem',
    fontWeight: '600',
    borderRadius: 'var(--radius-md)',
    cursor: isDisabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: isDisabled || isLoading ? 0.6 : 1,
    transition: 'all var(--transition-fast)',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <button
      disabled={isDisabled || isLoading}
      style={baseStyle}
      className={`app-btn app-btn-${variant} ${className}`}
      {...props}
    >
      {isLoading && <span className="spinner" style={{ width: '1rem', height: '1rem' }} />}
      {!isLoading && icon && <span className="btn-icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
