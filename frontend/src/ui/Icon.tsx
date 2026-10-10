import type { ComponentType } from 'react';
import { AccountIcon } from './icons/AccountIcon';
import { ActivityIcon } from './icons/ActivityIcon';
import { AreasIcon } from './icons/AreasIcon';
import type { CartoonIconProps } from './icons/CartoonSvg';
import { FilterIcon } from './icons/FilterIcon';
import { LocateIcon } from './icons/LocateIcon';
import { MapIcon } from './icons/MapIcon';
import { PrintIcon } from './icons/PrintIcon';
import { ReportIcon } from './icons/ReportIcon';
import { ShareIcon } from './icons/ShareIcon';

// The key icons are hand-drawn components (ui/icons, two-tone when active); the small utility ones are paths.
const DRAWN: Readonly<Record<string, ComponentType<CartoonIconProps>>> = {
  map: MapIcon,
  areas: AreasIcon,
  camera: ReportIcon,
  activity: ActivityIcon,
  account: AccountIcon,
  filter: FilterIcon,
  locate: LocateIcon,
  share: ShareIcon,
  print: PrintIcon,
};

const PATHS = {
  search: 'M11 4.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM16 16l4.5 4.5',
  close: 'M6 6l12 12M18 6L6 18',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5s9.5 6.5 9.5 6.5s-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5z',
  eyeOff: 'M4 4l16 16M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.5 7.6C4 9.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.4 9.4 0 0 0 4.3-1',
  confirm: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM8 12.5l3 3l5-6',
  metoo: 'M4 8.5h3L8.5 6h7L17 8.5h3V19H4zM12 11v6M9 14h6',
  cleaned: 'M15 3.5l-3.5 8M6.5 11.5h9l1.5 9H5zM9.5 15.5v5M12.5 15.5v5',
  letter: 'M4 6h16v12H4zM4 7l8 6l8-6',
  photo: 'M3.5 5.5h17v13h-17zM4.5 17l5-4.5l3.5 3l2.5-2l4 3.5M15.5 8.5h.01',
  offline: 'M7 18h10.5a3.5 3.5 0 0 0 .6-6.95A5.5 5.5 0 0 0 7.5 9.3A4.4 4.4 0 0 0 7 18zM4 4l16 16',
  info: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 11v5M12 7.5v.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  back: 'M19 12H5M11 6l-6 6l6 6',
  chevron: 'M9.5 6l6 6l-6 6',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2',
  video: 'M3.5 7h11v10h-11zM14.5 10.5l6-3.5v10l-6-3.5',
  inbox: 'M3.5 13.5l2.5-8h12l2.5 8v6h-17zM3.5 13.5h5l1 2.5h5l1-2.5h5',
  previous: 'M15 5l-7 7l7 7',
  next: 'M9 5l7 7l-7 7',
  retry: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
  sun: 'M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
} as const;

export type IconName = keyof typeof PATHS | 'map' | 'areas' | 'camera' | 'activity' | 'account' | 'filter' | 'locate' | 'share' | 'print';

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
}

export function Icon({ name, size = 24 }: IconProps) {
  const Drawn = DRAWN[name];
  if (Drawn) return <Drawn size={size} />;
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name as keyof typeof PATHS]} />
    </svg>
  );
}
