import React, { useEffect } from 'react';

export function Modal({ isOpen, onClose, title, children, footer = null, maxWidth = '42rem' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="app-modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="app-modal-content glass-card" style={{ maxWidth }}>
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '1.25rem 1.5rem', 
            borderBottom: '1px solid var(--border-color)' 
          }}
        >
          <h3 className="app-modal-title" style={{ margin: 0 }}>{title}</h3>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.25rem', 
              cursor: 'pointer', 
              color: 'var(--text-secondary)' 
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="app-modal-body" style={{ padding: '1.5rem' }}>
          {children}
        </div>
        {footer && (
          <div 
            className="modal-footer" 
            style={{ 
              padding: '1rem 1.5rem', 
              borderTop: '1px solid var(--border-color)', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '0.75rem' 
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
