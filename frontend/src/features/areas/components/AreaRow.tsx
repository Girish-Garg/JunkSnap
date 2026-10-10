import { areaPath } from '../../../app/paths';
import { SheetLink } from '../../../app/SheetLink';
import { AreaProgress } from '../../../domain/AreaProgress';
import { Icon } from '../../../ui/Icon';
import { TintSwatch } from '../../../ui/TintSwatch';
import type { AreaEntry } from '../hooks/useAreaDirectory';
import { useAreaProgressText } from '../hooks/useAreaProgressText';
import { DistrictCrawl } from './DistrictCrawl';

interface AreaRowProps {
  readonly entry: AreaEntry;
  /** The area's colour slot on the map, when the map draws it. */
  readonly tint: number | undefined;
}

/** One area: its map colour and name, its counts (zeros included) and where it stands, linking to its page. */
export function AreaRow({ entry: { area, row }, tint }: AreaRowProps) {
  const text = useAreaProgressText();
  const progress = AreaProgress.of(row);
  const lines = text.lines(progress);
  return (
    <li>
      <SheetLink className={`area-row area-row--${progress.stage}`} to={areaPath(area.kind, area.id)}>
        <span className="area-row__name">
          {/* A scored area is drawn in its score colour, not its tint, so the chip would not match the map. */}
          <TintSwatch tint={progress.stage === 'scored' ? null : tint} />
          {area.name}
        </span>
        <span className="area-row__meta">{lines.counts}</span>
        <span className="area-row__status">{lines.status}</span>
        <Icon name="chevron" size={20} />
      </SheetLink>
      <DistrictCrawl districtId={area.districtId} />
    </li>
  );
}
