import { Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function Header() {
  const { t } = useI18n();

  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <span className="brand__mark" aria-hidden="true">
          <Printer size={20} strokeWidth={2} />
        </span>
        <span className="brand__text">
          <span className="brand__name">{t('app.name')}</span>
          <span className="brand__tagline">{t('app.tagline')}</span>
        </span>
      </Link>
      {/* Process-colour strip: a small nod to CMYK printing */}
      <span className="cmyk-strip" aria-hidden="true">
        <i /><i /><i /><i />
      </span>
      <div className="app-header__end">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
