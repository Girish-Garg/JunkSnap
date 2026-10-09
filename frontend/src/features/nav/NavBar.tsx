import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from '../../ui/Icon';
import { useAuthFlow } from '../auth/hooks/useAuthFlow';
import { NAV_ITEMS, NavItems, type NavItem } from './NavItems';
import './nav.css';

/** Material 3 navigation bar on phones; a navigation rail on desktop (nav.css). */
export function NavBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { requireAuth } = useAuthFlow();
  const selected = NavItems.selected(pathname);
  const go = (item: NavItem) => {
    const open = () => navigate(item.path);
    if (item.needsAccount) requireAuth(open);
    else open();
  };
  return (
    <nav className="nav-bar" aria-label={t('nav.label')}>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-bar__item nav-bar__item--${item.id}`}
          aria-current={item.id === selected ? 'page' : undefined}
          onClick={() => go(item)}
        >
          <span className="nav-bar__indicator">
            <Icon name={item.icon} size={item.id === 'report' ? 24 : 22} />
          </span>
          <span className="nav-bar__label">{t(`nav.${item.id}`)}</span>
        </button>
      ))}
    </nav>
  );
}
