import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msgOrOpts, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    let toastType = type;
    let message = '';
    let toastDuration = duration;

    if (typeof msgOrOpts === 'object' && msgOrOpts !== null) {
      message = msgOrOpts.message ?? msgOrOpts.text ?? msgOrOpts.title ?? '';
      toastType = msgOrOpts.type ?? type ?? 'info';
      toastDuration = msgOrOpts.duration ?? duration ?? 3000;
    } else {
      message = String(msgOrOpts ?? '');
    }

    setToasts((prev) => [...prev, { id, type: toastType, message, duration: toastDuration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  }, []);

  const toastFn = useCallback((msgOrOpts, type = 'info', duration = 3000) => {
    addToast(msgOrOpts, type, duration);
  }, [addToast]);

  toastFn.toast = toastFn;
  toastFn.addToast = addToast;
  toastFn.removeToast = removeToast;

  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast, onRemove]);

  const typeClassMap = {
    info: 'toast-item-info',
    success: 'toast-item-success',
    error: 'toast-item-error',
    warning: 'toast-item-warning'
  };

  const typeClass = typeClassMap[toast.type] || typeClassMap.info;

  return (
    <div className={`toast-item glass-card ${typeClass}`}>
      <span style={{ fontWeight: 600, flex: 1, wordBreak: 'break-word' }}>
        {toast.message}
      </span>
      <button 
        onClick={() => onRemove(toast.id)}
        className="toast-close-btn"
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}
