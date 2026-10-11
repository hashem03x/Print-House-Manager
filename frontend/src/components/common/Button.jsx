import Spinner from './Spinner.jsx';

/**
 * @param {'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'} variant
 * @param {'md' | 'sm'} size
 * @param icon Optional Lucide icon component rendered before the label.
 * @param loading Shows a spinner and disables the button (prevents double submits).
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  type = 'button',
  className = '',
  disabled,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={16} /> : Icon && <Icon className="btn__icon" size={18} aria-hidden="true" />}
      {children && <span>{children}</span>}
    </button>
  );
}
