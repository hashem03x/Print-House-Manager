import { ClipboardList, LayoutDashboard } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', labelKey: 'nav.tasks', icon: ClipboardList },
];

export default function Sidebar() {
  const { t } = useI18n();

  return (
    <nav className="sidebar" aria-label={t('nav.label')}>
      <ul className="sidebar__list">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
              title={t(labelKey)}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="sidebar__label">{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
