import { useTranslation } from 'react-i18next';
import { areaPath } from '../../../app/paths';
import { SheetLink } from '../../../app/SheetLink';
import type { AreaKind } from '../../../domain/AreaScores';
import { Icon } from '../../../ui/Icon';
import type { AreaEntry } from '../hooks/useAreaDirectory';
import { DistrictCrawl } from './DistrictCrawl';

interface AreaGroupProps {
  readonly kind: AreaKind;
  readonly entries: readonly AreaEntry[];
}

export function AreaGroup({ kind, entries }: AreaGroupProps) {
  const { t } = useTranslation();
  if (entries.length === 0) return null;
  return (
    <section className="area-group">
      <h3 className="area-group__title">{t(`areas.kinds.${kind}`)}</h3>
      <ul className="area-group__list stagger">
        {entries.map(({ area, sites, verified }) => (
          <li key={area.key}>
            <SheetLink className="area-row" to={areaPath(area.kind, area.id)}>
              <span className="area-row__name">{area.name}</span>
              <span className="area-row__meta">{t('areas.rowCounts', { sites: String(sites), verified: String(verified) })}</span>
              <Icon name="chevron" size={20} />
            </SheetLink>
            <DistrictCrawl districtId={area.districtId} />
          </li>
        ))}
      </ul>
    </section>
  );
}
