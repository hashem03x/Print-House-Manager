import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { ToastContext } from './ToastContext.js';

const DURATION_MS = { success: 4000, info: 5000, error: 7000 };
const MAX_TOASTS = 4;
const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

export function ToastProvider({ children }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type, messageKey, params) => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { id, type, messageKey, params }]);
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS[type]));
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const api = useMemo(
    () => ({
      success: (key, params) => push('success', key, params),
      error: (key, params) => push('error', key, params),
      info: (key, params) => push('info', key, params),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section className="toast-region" aria-label={t('toast.region')}>
        {/* Separate live regions so errors are announced assertively. */}
        <div aria-live="polite" className="toast-stack">
          {toasts
            .filter((toast) => toast.type !== 'error')
            .map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} t={t} />
            ))}
        </div>
        <div aria-live="assertive" className="toast-stack">
          {toasts
            .filter((toast) => toast.type === 'error')
            .map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} t={t} />
            ))}
        </div>
      </section>
    </ToastContext.Provider>
  );
}

// Params named `<name>Key` hold translation keys and are translated at render time,
// so toasts follow language switches (e.g. { reasonKey: 'errors.network' } fills {{reason}}).
function resolveParams(params, t) {
  if (!params) return params;
  const resolved = {};
  for (const [name, value] of Object.entries(params)) {
    if (name.endsWith('Key') && typeof value === 'string') resolved[name.slice(0, -3)] = t(value);
    else resolved[name] = value;
  }
  return resolved;
}

function ToastItem({ toast, onDismiss, t }) {
  const Icon = ICONS[toast.type];
  return (
    <div className={`toast toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <Icon className="toast__icon" size={20} aria-hidden="true" />
      <p className="toast__message">{t(toast.messageKey, resolveParams(toast.params, t))}</p>
      <button type="button" className="toast__close" aria-label={t('toast.dismiss')} onClick={() => onDismiss(toast.id)}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
