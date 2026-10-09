import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { MarkerGlyph } from '../../../ui/MarkerGlyph';
import { useDistanceLabel } from '../hooks/useDistanceLabel';
import { useSitePresenter } from '../hooks/useSitePresenter';
import '../site.css';
import { SitePhoto } from './SitePhoto';
import { StatusBadge } from './StatusBadge';

interface SitePreviewCardProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
  readonly onDetails: (site: SiteFeature) => void;
}

/** Compact card after tapping a pin; Details opens the full sheet. */
export function SitePreviewCard({ site, userLocation, onDetails }: SitePreviewCardProps) {
  const { t } = useTranslation();
  const details = site.properties;
  const thumbnail = useSitePresenter(details).thumbnail();
  const distance = useDistanceLabel(site, userLocation);
  return (
    <section className="preview-card" aria-label={t(`reportType.${details.report_type}`)}>
      <ul className="preview-card__thumb">
        <SitePhoto key={thumbnail} url={thumbnail} alt="" />
      </ul>
      <div className="preview-card__body">
        <p className="preview-card__title">
          <MarkerGlyph type={details.report_type} size={20} />
          {t(`reportType.${details.report_type}`)}
        </p>
        <p className="preview-card__meta">
          <StatusBadge status={details.status} />
          <span>{t('preview.reports', { count: details.report_count })}</span>
          {distance && <span>{distance}</span>}
        </p>
        <Button variant="text" onClick={() => onDetails(site)}>
          {t('preview.details')}
        </Button>
      </div>
    </section>
  );
}
