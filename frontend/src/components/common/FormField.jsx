import { CircleAlert } from 'lucide-react';

/**
 * Label + control + hint/error wrapper.
 * The control should use `id={id}` and `aria-describedby={describedBy(id, hint, error)}`.
 * `aside` renders next to the hint (e.g. a character counter).
 */
export default function FormField({ id, label, required, requiredLabel, hint, error, aside, children }) {
  return (
    <div className={`form-field ${error ? 'form-field--invalid' : ''}`}>
      <label htmlFor={id} className="form-field__label">
        {label}
        {required && (
          <span className="form-field__required" aria-hidden="true" title={requiredLabel}>
            *
          </span>
        )}
      </label>
      {children}
      <div className="form-field__meta">
        {error ? (
          <p id={`${id}-error`} className="form-field__error">
            <CircleAlert size={14} aria-hidden="true" />
            {error}
          </p>
        ) : (
          hint && (
            <p id={`${id}-hint`} className="form-field__hint">
              {hint}
            </p>
          )
        )}
        {aside}
      </div>
    </div>
  );
}

export function describedBy(id, hint, error) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
