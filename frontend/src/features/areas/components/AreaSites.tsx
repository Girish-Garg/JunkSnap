import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { AreaKey } from '../../../domain/AreaKey';
import type { AreaScores } from '../../../domain/AreaScores';
import { TypeIcon } from '../../../ui/TypeIcon';
import { useMapContext } from '../../map/useMapContext';

interface AreaSitesProps {
  readonly area: AreaScores['area'];
}

/** The area's sites among those loaded on the map; each opens its sheet and moves the map to it. */
export function AreaSites({ area }: AreaSitesProps) {
  const { t } = useTranslation();
  const { sites } = useMapContext();
  const { linkState } = useSheetNavigation();
  const key = new AreaKey(area.kind, area.id, area.name);
  const held = sites.filter((site) => key.holds(site));
  if (held.length === 0) return null;
  return (
    <section className="area-sites">
      <h3 className="facts__title">{t('areas.sitesTitle')}</h3>
      <ul className="area-sites__list">
        {held.map(({ properties: site }) => (
          <li key={site.site_id}>
            <Link className="area-site" to={sitePath(site.site_id)} state={linkState}>
              <TypeIcon type={site.report_type} size={24} />
              <span className="area-site__text">
                <span>{t(`reportType.${site.report_type}`)}</span>
                <span className="area-row__meta">{t(`status.${site.status}`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
