import { CloudOff, RotateCw } from 'lucide-react';
import Button from './Button.jsx';

/** Inline error panel with an optional retry action. Texts are already translated. */
export default function ErrorState({ title, message, retryLabel, onRetry, compact = false }) {
  return (
    <div className={`error-state ${compact ? 'error-state--compact' : ''}`} role="alert">
      <div className="error-state__icon" aria-hidden="true">
        <CloudOff size={compact ? 20 : 26} strokeWidth={1.75} />
      </div>
      <div className="error-state__text">
        {title && <h2 className="error-state__title">{title}</h2>}
        <p className="error-state__message">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size={compact ? 'sm' : 'md'} icon={RotateCw} onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
