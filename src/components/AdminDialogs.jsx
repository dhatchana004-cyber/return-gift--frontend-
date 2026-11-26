import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const AdminFeedbackContext = createContext(null);

export function AdminFeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const toastIdRef = useRef(0);
  const savedScrollYRef = useRef(null);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((variant, message, title) => {
    if (!message) return;
    const id = ++toastIdRef.current;
    const duration = variant === 'error' ? 5500 : 4000;
    setToasts((prev) => [...prev.slice(-3), { id, variant, message, title }]);
    window.setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  const notify = useMemo(() => ({
    success: (message, title = 'Updated') => pushToast('success', message, title),
    deleted: (message, title = 'Deleted') => pushToast('deleted', message, title),
    error: (message, title = 'Action failed') => pushToast('error', message, title),
  }), [pushToast]);

  const restoreScrollY = useCallback(() => {
    const y = savedScrollYRef.current;
    savedScrollYRef.current = null;
    if (typeof y === 'number') {
      window.requestAnimationFrame(() => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({ top: Math.min(y, maxScroll), behavior: 'instant' });
      });
    }
  }, []);

  const confirmDelete = useCallback(({ title, message, confirmLabel = 'Delete', onConfirm }) => {
    savedScrollYRef.current = window.scrollY;
    setDialog({ title, message, confirmLabel, onConfirm });
  }, []);

  const closeDialog = useCallback(() => {
    if (confirmBusy) return;
    setDialog(null);
    restoreScrollY();
  }, [confirmBusy, restoreScrollY]);

  const handleConfirm = async () => {
    if (!dialog || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await dialog.onConfirm?.();
    } finally {
      setConfirmBusy(false);
      setDialog(null);
      restoreScrollY();
    }
  };

  useEffect(() => {
    if (!dialog) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, closeDialog]);

  const contextValue = useMemo(() => ({ notify, confirmDelete }), [notify, confirmDelete]);

  return (
    <AdminFeedbackContext.Provider value={contextValue}>
      {children}

      {toasts.length > 0 && (
        <div className="admin-toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => {
            const iconClass =
              toast.variant === 'error'
                ? 'bi-exclamation-triangle-fill'
                : toast.variant === 'deleted'
                  ? 'bi-trash3-fill'
                  : 'bi-check-circle-fill';
            return (
              <div key={toast.id} className={`admin-toast admin-toast-${toast.variant}`}>
                <span className="admin-toast-icon">
                  <i className={`bi ${iconClass}`} />
                </span>
                <div className="admin-toast-body">
                  <strong>{toast.title}</strong>
                  <span>{toast.message}</span>
                </div>
                <button
                  type="button"
                  className="admin-toast-close"
                  aria-label="Close notification"
                  onClick={() => dismissToast(toast.id)}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {dialog && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
          >
            <div className="admin-modal-icon">
              <i className="bi bi-trash3" />
            </div>
            <h3 id="admin-confirm-title">{dialog.title}</h3>
            <p>{dialog.message}</p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="button button-outline"
                disabled={confirmBusy}
                onClick={closeDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={confirmBusy}
                onClick={handleConfirm}
              >
                {confirmBusy ? 'Deleting…' : dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminFeedbackContext.Provider>
  );
}

const fallbackFeedback = {
  notify: {
    success: () => {},
    deleted: () => {},
    error: () => {},
  },
  confirmDelete: ({ message, onConfirm }) => {
    if (window.confirm(message)) onConfirm?.();
  },
};

export function useAdminFeedback() {
  return useContext(AdminFeedbackContext) || fallbackFeedback;
}
