import { Search } from 'lucide-react';

/**
 * Visual search field. Pass `value` + `onChange` (controlled) or `defaultValue`.
 */
export default function SearchInput({ id, label, placeholder, ...props }) {
  return (
    <div className="search-input">
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <Search className="search-input__icon" size={18} aria-hidden="true" />
      <input id={id} type="search" className="input search-input__field" placeholder={placeholder} {...props} />
    </div>
  );
}
