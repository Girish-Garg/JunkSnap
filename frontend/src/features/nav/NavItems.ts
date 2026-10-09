import { ACCOUNT_PATH, AREAS_PATH, SNAP_PATH } from '../../app/paths';
import type { IconName } from '../../ui/Icon';

export type NavId = 'map' | 'report' | 'areas' | 'account';

export interface NavItem {
  readonly id: NavId;
  readonly icon: IconName;
  readonly path: string;
  /** Signed-out users sign in first, then land on the path. */
  readonly needsAccount: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'map', icon: 'map', path: '/', needsAccount: false },
  { id: 'report', icon: 'camera', path: SNAP_PATH, needsAccount: true },
  { id: 'areas', icon: 'areas', path: AREAS_PATH, needsAccount: false },
  { id: 'account', icon: 'account', path: ACCOUNT_PATH, needsAccount: true },
];

/** The item whose path owns the current URL; site sheets belong to the map. */
export class NavItems {
  static selected(pathname: string): NavId {
    return NAV_ITEMS.find((item) => item.path !== '/' && pathname.startsWith(item.path))?.id ?? 'map';
  }
}
