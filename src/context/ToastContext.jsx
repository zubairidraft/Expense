import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 5000;

/**
 * Global snackbar. showToast({ message, actionLabel?, onAction?, duration?, tone? })
 * Used for "Undo" after delete / status change.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback(
    ({ message, actionLabel, onAction, duration = DEFAULT_DURATION, tone = 'info' }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const id = Date.now() + Math.random();
      setToast({ id, message, actionLabel, onAction, duration, tone });
      timerRef.current = setTimeout(() => {
        setToast((cur) => (cur && cur.id === id ? null : cur));
      }, duration);
      return id;
    },
    []
  );

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  const handleAction = async () => {
    const fn = toast?.onAction;
    dismissToast();
    if (fn) await fn();
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            zIndex: 10000,
            maxWidth: 'min(92vw, 420px)',
            width: 'max-content',
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            padding: '0.7rem 1rem',
            borderRadius: '12px',
            background: toast.tone === 'error' ? '#b91c1c' : '#1f2937',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            fontSize: '0.9rem',
            overflow: 'hidden',
          }}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              onClick={handleAction}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#93c5fd',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: '0.25rem 0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <span
            key={toast.id}
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: '3px',
              background: '#93c5fd',
              width: '100%',
              transformOrigin: 'left',
              animation: `toast-countdown ${toast.duration}ms linear forwards`,
            }}
          />
          <style>{`@keyframes toast-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so components never crash without the provider
    return { showToast: () => {}, dismissToast: () => {} };
  }
  return ctx;
}
