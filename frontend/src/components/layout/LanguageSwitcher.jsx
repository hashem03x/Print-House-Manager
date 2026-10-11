import { Languages } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';

// The only interactive feature in the template: switches language and direction.
export default function LanguageSwitcher() {
  const { t, language, languages, setLanguage } = useI18n();

  return (
    <div className="lang-switcher" role="group" aria-label={t('language.label')}>
      <Languages className="lang-switcher__icon" size={16} aria-hidden="true" />
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          lang={lang.code}
          className="lang-switcher__option"
          aria-pressed={language === lang.code}
          onClick={() => setLanguage(lang.code)}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
