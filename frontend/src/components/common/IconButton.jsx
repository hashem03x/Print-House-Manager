import Spinner from './Spinner.jsx';

/**
 * Square icon-only button. `label` is required for screen readers and the tooltip.
 * `loading` shows a spinner and disables the button.
 */
export default function IconButton({
  icon: Icon,
  label,
  variant = 'default',
  loading = false,
  disabled,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn--${variant} ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={16} /> : <Icon size={18} aria-hidden="true" />}
    </button>
  );
}
