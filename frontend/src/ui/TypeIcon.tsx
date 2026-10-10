import type { ComponentType } from 'react';
import type { ReportType } from '../domain/ReportType';
import type { CartoonIconProps } from './icons/CartoonSvg';
import { ConstructionIcon } from './icons/ConstructionIcon';
import { DumpIcon } from './icons/DumpIcon';
import { NoBinIcon } from './icons/NoBinIcon';
import { OverflowingBinIcon } from './icons/OverflowingBinIcon';
import { WaterIcon } from './icons/WaterIcon';

const ICONS: Readonly<Record<ReportType, ComponentType<CartoonIconProps>>> = {
  waste_dump: DumpIcon,
  no_bin: NoBinIcon,
  contaminated_water: WaterIcon,
  open_construction: ConstructionIcon,
  overflowing_bin: OverflowingBinIcon,
};

interface TypeIconProps {
  readonly type: ReportType;
  readonly size?: number;
}

/** Hand-drawn report-type icon filled with its type colour; decorative, the label next to it names the type. */
export function TypeIcon({ type, size = 24 }: TypeIconProps) {
  const Drawn = ICONS[type];
  return (
    <span className={`type-icon type-icon--${type}`}>
      <Drawn size={size} />
    </span>
  );
}
