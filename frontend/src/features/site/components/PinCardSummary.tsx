import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { TypeIcon } from '../../../ui/TypeIcon';
import { useSiteDistance } from '../hooks/useSiteDistance';
import { useSitePresenter } from '../hooks/useSitePresenter';
import { SiteThumb } from './SiteThumb';
import { StatusChip } from './StatusChip';

interface PinCardSummaryProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
  readonly title: string;
}

/** The pin card's top: the newest blurred photo, the type and title on one line, the status chip, "1 report · 3.5 km". */
export function PinCardSummary({ site, userLocation, title }: PinCardSummaryProps) {
  const { t } = useTranslation();
  const details = site.properties;
  const distance = useSiteDistance(site, userLocation);
  const meta = [t('preview.reports', { count: details.report_count }), distance?.short].filter(Boolean).join(' · ');
  return (
    <div className="pin-card__main">
      <SiteThumb className="pin-card__thumb" url={useSitePresenter(details).thumbnail()} />
      <div className="pin-card__text">
        <p className="pin-card__title">
          <span className={`pin-card__type type-chip--${details.report_type}`} aria-hidden="true">
            <TypeIcon type={details.report_type} size={18} />
          </span>
          <span className="pin-card__name">{title}</span>
        </p>
        <StatusChip site={details} />
        <p className="pin-card__meta">{meta}</p>
      </div>
    </div>
  );
}
