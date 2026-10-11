import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import type { PlaceRow } from '../hooks/useReportedPlaces';

interface PlaceItemProps {
  readonly row: PlaceRow;
  readonly onPick: (row: PlaceRow) => void;
}

/**
 * One place: its name as the data has it (area names are never translated), what kind of place it is, and how many
 * sites are on the map there. No count shows when none could be loaded, so a failed list never reads as zero.
 */
export function PlaceItem({ row, onPick }: PlaceItemProps) {
  const { t } = useTranslation();
  const { area, count, pilot } = row.place;
  const seat = area.kind !== 'district';
  const kind = seat ? t('place.assembly') : t('areas.kind.district');
  return (
    <li>
      <button type="button" className={seat ? 'site-row place-row place-row--seat' : 'site-row place-row'} onClick={() => onPick(row)}>
        <span className="site-row__text">
          <strong>{area.name}</strong>
          <span className="site-row__meta">{pilot ? `${kind} · ${t('site.pilot')}` : kind}</span>
        </span>
        {count !== null && <span className="place-row__count num">{t('search.siteCount', { count })}</span>}
        <Icon name="chevron" size={20} />
      </button>
    </li>
  );
}
