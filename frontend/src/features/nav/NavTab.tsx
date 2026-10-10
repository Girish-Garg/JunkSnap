import { Icon } from '../../ui/Icon';
import type { NavItem } from './NavItems';

interface NavTabProps {
  readonly item: NavItem;
  readonly current: boolean;
  readonly label: string;
  readonly onPick: (item: NavItem) => void;
}

export function NavTab({ item, current, label, onPick }: NavTabProps) {
  return (
    <button
      type="button"
      className={`nav-bar__item nav-bar__item--${item.id}`}
      aria-current={current ? 'page' : undefined}
      onClick={() => onPick(item)}
    >
      <span className="nav-bar__indicator">
        <Icon name={item.icon} size={item.id === 'report' ? 28 : 24} />
      </span>
      <span className="nav-bar__label">{label}</span>
    </button>
  );
}
