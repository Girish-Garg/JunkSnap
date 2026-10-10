import { areaPath } from '../../../app/paths';
import { SheetLink } from '../../../app/SheetLink';
import { AreaProgress } from '../../../domain/AreaProgress';
import { Icon } from '../../../ui/Icon';
import { TintSwatch } from '../../../ui/TintSwatch';
import type { AreaEntry } from '../hooks/useAreaDirectory';
import { AreaRowLines } from './AreaRowLines';
import { DistrictCrawl } from './DistrictCrawl';

interface AreaRowProps {
  readonly entry: AreaEntry;
  /** The area's colour slot on the map, when the map draws it. */
  readonly tint: number | undefined;
}

/**
 * One area: its map colour and name, its counts (zeros included) and where it stands, linking to its page. When its
 * list failed it says so instead of showing counts, so a failure never reads as "No reports yet".
 */
export function AreaRow({ entry: { area, row, unloaded }, tint }: AreaRowProps) {
  const progress = AreaProgress.of(row);
  const stage = unloaded ? 'unloaded' : progress.stage;
  return (
    <li>
      <SheetLink className={`area-row area-row--${stage}`} to={areaPath(area.kind, area.id)}>
        <span className="area-row__name">
          {/* A scored area is drawn in its score colour, not its tint, so the chip would not match the map. */}
          <TintSwatch tint={stage === 'scored' ? null : tint} />
          {area.name}
        </span>
        <AreaRowLines progress={progress} unloaded={unloaded} pilot={row?.pilot === true} />
        <Icon name="chevron" size={20} />
      </SheetLink>
      <DistrictCrawl districtId={area.districtId} />
    </li>
  );
}
