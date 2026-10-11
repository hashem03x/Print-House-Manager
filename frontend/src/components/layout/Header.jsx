import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import BrandLogo from '../brand/BrandLogo.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function Header() {
  const { t } = useI18n();

  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label={t('app.homeLabel')}>
        <span className="brand__full">
          <BrandLogo tagline={t('app.tagline')} />
        </span>
        {/* Very narrow screens: compact mark only */}
        <span className="brand__compact">
          <BrandLogo variant="compact" />
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
