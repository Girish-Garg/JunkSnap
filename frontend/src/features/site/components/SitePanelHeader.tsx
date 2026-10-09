import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { MarkerGlyph } from '../../../ui/MarkerGlyph';
import { useDistanceLabel } from '../hooks/useDistanceLabel';
import { SiteBadges } from './SiteBadges';

interface SitePanelHeaderProps {
  readonly site: SiteFeature;
  readonly titleId: string;
  readonly userLocation: LonLat | null;
}

export function SitePanelHeader({ site, titleId, userLocation }: SitePanelHeaderProps) {
  const { t } = useTranslation();
  const details = site.properties;
  const distance = useDistanceLabel(site, userLocation);
  const place = [details.location.town, details.location.state].filter(Boolean).join(', ');
  return (
    <header className="site-header">
      <h2 id={titleId} className="site-header__title">
        <MarkerGlyph type={details.report_type} size={24} />
        {t(`reportType.${details.report_type}`)}
      </h2>
      <p className="site-header__meta">
        <span className={`status status--${details.status}`}>{t(`status.${details.status}`)}</span>
        <span>{t(`verification.${details.verification}`)}</span>
        {distance && <span>{distance}</span>}
      </p>
      <p className="site-header__context">
        {t(`context.${details.context}`)} · {place}
      </p>
      <SiteBadges site={details} />
    </header>
  );
}
