import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ConfirmContext = createContext(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

export function ConfirmProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState({
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDestructive: false,
    confirmBtnClass: null
  });
  
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    const optionsObj = typeof opts === 'string'
      ? { title: 'Confirm', message: opts, confirmText: 'Confirm', cancelText: 'Cancel', isDestructive: false, confirmBtnClass: null }
      : {
          title: opts?.title || 'Confirm',
          message: opts?.message || '',
          confirmText: opts?.confirmText || 'Confirm',
          cancelText: opts?.cancelText !== undefined ? opts.cancelText : 'Cancel',
          isDestructive: opts?.isDestructive || false,
          confirmBtnClass: opts?.confirmBtnClass || null
        };

    setOptions(optionsObj);
    setIsOpen(true);
    
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  confirm.confirm = confirm;

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolver.current) resolver.current(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolver.current) resolver.current(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {isOpen && (
        <div 
          className="app-modal-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="app-modal-content glass-card" style={{ maxWidth: '400px' }}>
            <div style={{ padding: '1.5rem 1.5rem 0.5rem' }}>
              <h3 className="app-modal-title" style={{ margin: 0 }}>{options.title}</h3>
            </div>
            <div className="app-modal-body" style={{ padding: '0.5rem 1.5rem 1.5rem', color: 'var(--foreground)' }}>
              {options.message}
            </div>
            <div 
              className="modal-footer" 
              style={{ 
                padding: '1rem 1.5rem', 
                borderTop: '1px solid var(--glass-border)', 
                display: 'flex', 
                justify: 'flex-end', 
                gap: '0.75rem',
                background: 'var(--glass-bg)'
              }}
            >
              {options.cancelText && (
                <button className="btn btn-secondary" onClick={handleCancel}>
                  {options.cancelText}
                </button>
              )}
              <button 
                className={options.confirmBtnClass ? options.confirmBtnClass : (options.isDestructive ? "btn btn-destructive" : "btn btn-primary")} 
                onClick={handleConfirm}
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
