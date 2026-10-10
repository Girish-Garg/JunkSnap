import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { useSheetNavigation } from '../../app/useSheetNavigation';
import { Logo } from '../../ui/Logo';
import { useAuthFlow } from '../auth/hooks/useAuthFlow';
import { NAV_ITEMS, NavItems, type NavItem } from './NavItems';
import { NavTab } from './NavTab';
import './nav.css';

/** A bottom bar with Report raised in the centre on phones; the head of the side panel on desktop (nav.css). */
export function NavBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const sheets = useSheetNavigation();
  const { requireAuth } = useAuthFlow();
  const selected = NavItems.selected(pathname);
  // Tabs replace each other, so back from any tab returns to the map and back from the map leaves.
  const go = (item: NavItem) => {
    if (item.path === '/') return sheets.home();
    const open = () => (pathname === '/' ? sheets.open(item.path) : sheets.swap(item.path));
    if (item.needsAccount) requireAuth(open);
    else open();
  };
  return (
    <nav className="nav-bar" aria-label={t('nav.label')}>
      <div className="nav-bar__brand">
        <Logo />
      </div>
      {NAV_ITEMS.map((item) => (
        <NavTab key={item.id} item={item} current={item.id === selected} label={t(`nav.${item.id}`)} onPick={go} />
      ))}
    </nav>
  );
}
