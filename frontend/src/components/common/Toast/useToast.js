import { useContext } from 'react';
import { ToastContext } from './ToastContext.js';

/**
 * Returns { success, error, info, dismiss }. Messages are translation keys,
 * translated at render time so they follow language switches.
 * Usage: toast.success('toast.created');
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
