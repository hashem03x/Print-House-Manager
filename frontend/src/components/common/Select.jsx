import { ChevronDown } from 'lucide-react';

/**
 * Styled native <select>. `options` is [{ value, label }].
 * `placeholder` renders an empty first option (e.g. "All sizes").
 * `icon` renders a leading Lucide icon.
 */
export default function Select({ options, placeholder, className = '', invalid, icon: Icon, ...props }) {
  return (
    <div className={`select ${Icon ? 'select--with-icon' : ''} ${className}`}>
      {Icon && <Icon className="select__icon" size={16} aria-hidden="true" />}
      <select className="input select__field" aria-invalid={invalid || undefined} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="select__chevron" size={16} aria-hidden="true" />
    </div>
  );
}
