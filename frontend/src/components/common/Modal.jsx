import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import IconButton from './IconButton.jsx';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focus moves inside on open (to [data-autofocus] or the
 * first focusable element), Tab is trapped, Escape and backdrop clicks close it
 * (unless `busy`), body scroll is locked, and focus returns to the opener.
 */
export default function Modal({
  isOpen,
  titleId,
  title,
  description,
  closeLabel,
  onClose,
  footer,
  busy = false,
  role = 'dialog',
  size = 'md',
  children,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!isOpen) return undefined;
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    (dialog.querySelector('[data-autofocus]') ?? focusables()[0] ?? dialog).focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (!busyRef.current) onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget && !busy) onClose?.();
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        ref={dialogRef}
        className={`modal modal--${size}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <header className="modal__header">
          <div className="modal__heading">
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
            {description && <p className="modal__description">{description}</p>}
          </div>
          <IconButton icon={X} label={closeLabel} onClick={onClose} disabled={busy} />
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
