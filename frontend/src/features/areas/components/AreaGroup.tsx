import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { areaPath } from '../../../app/paths';
import type { AreaKind } from '../../../domain/AreaScores';
import type { AreaEntry } from '../hooks/useAreaDirectory';

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
      <ul className="area-group__list">
        {entries.map(({ area, sites }) => (
          <li key={area.key}>
            <Link className="area-row" to={areaPath(area.kind, area.id)}>
              <span className="area-row__name">{area.name}</span>
              <span className="area-row__meta">{t('areas.sitesOnMap', { n: String(sites) })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
