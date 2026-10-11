import { ACCOUNT_PATH, ACTIVITY_PATH, AREAS_PATH, SNAP_PATH } from '../../app/paths';
import type { IconName } from '../../ui/Icon';

export type NavId = 'map' | 'areas' | 'report' | 'activity' | 'account';

export interface NavItem {
  readonly id: NavId;
  readonly icon: IconName;
  readonly path: string;
  /** Signed-out users sign in first, then land on the path. */
  readonly needsAccount: boolean;
}

// Five equal slots with Report in the centre, like other map apps with a centre action.
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'map', icon: 'map', path: '/', needsAccount: false },
  { id: 'areas', icon: 'areas', path: AREAS_PATH, needsAccount: false },
  { id: 'report', icon: 'camera', path: SNAP_PATH, needsAccount: true },
  { id: 'activity', icon: 'activity', path: ACTIVITY_PATH, needsAccount: true },
  // Account opens for everyone: settings and the welcome cards need no sign-in; its card offers it.
  { id: 'account', icon: 'account', path: ACCOUNT_PATH, needsAccount: false },
];

/** The item whose path owns the current URL; site sheets belong to the map. */
export class NavItems {
  static selected(pathname: string): NavId {
    return NAV_ITEMS.find((item) => item.path !== '/' && pathname.startsWith(item.path))?.id ?? 'map';
  }
}
