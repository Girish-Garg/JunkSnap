import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaName } from '../../../domain/AreaName';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { TypeIcon } from '../../../ui/TypeIcon';
import { useDistanceLabel } from '../../site/hooks/useDistanceLabel';
import { useSitePresenter } from '../../site/hooks/useSitePresenter';
import '../../site/site.css';
import { SiteChipBadge } from './SiteChipBadge';
import { SiteThumb } from './SiteThumb';

interface SiteCardRowProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
  /** The row last opened on the map: a second tap opens its details. */
  readonly current: boolean;
  readonly onChoose: (site: SiteFeature) => void;
  /** Roving focus: tab index, focus tracking and the item's index. */
  readonly focus: HTMLAttributes<HTMLButtonElement>;
}

/** One compact card of the site list: photo, type, area, status chip, report count and distance when known. */
export function SiteCardRow({ site, userLocation, current, onChoose, focus }: SiteCardRowProps) {
  const { t } = useTranslation();
  const details = site.properties;
  const distance = useDistanceLabel(site, userLocation);
  return (
    <li>
      <button type="button" className="site-row site-card" aria-current={current || undefined} onClick={() => onChoose(site)} {...focus}>
        <SiteThumb url={useSitePresenter(details).thumbnail()} className="site-card__thumb" />
        <span className="site-row__text">
          <span className="site-card__title">
            <span className={`type-chip type-chip--small type-chip--${details.report_type}`}>
              <TypeIcon type={details.report_type} size={20} />
            </span>
            <strong>{t(`reportType.${details.report_type}`)}</strong>
          </span>
          <span className="site-card__area">{AreaName.of(details.location)}</span>
          <span className="site-row__meta">
            <SiteChipBadge site={details} />
            <span>{t('preview.reports', { count: details.report_count })}</span>
            {distance && <span>{distance}</span>}
          </span>
          {current && <span className="site-card__again">{t('browse.again')}</span>}
        </span>
      </button>
    </li>
  );
}
