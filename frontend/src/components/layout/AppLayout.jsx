import { Outlet } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

export default function AppLayout() {
  const { t } = useI18n();

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <Header />
      <div className="app-body">
        <Sidebar />
        <main id="main-content" className="app-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
