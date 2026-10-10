import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { TypeIcon } from '../../../ui/TypeIcon';
import { useDistanceLabel } from '../hooks/useDistanceLabel';
import type { SitePresenter } from '../SitePresenter';
import { SiteBadges } from './SiteBadges';
import { StatusBadge } from './StatusBadge';

interface SitePanelHeaderProps {
  readonly site: SiteFeature;
  readonly titleId: string;
  readonly userLocation: LonLat | null;
  readonly presenter: SitePresenter;
}

export function SitePanelHeader({ site, titleId, userLocation, presenter }: SitePanelHeaderProps) {
  const { t } = useTranslation();
  const details = site.properties;
  const distance = useDistanceLabel(site, userLocation);
  const place = [details.location.town, details.location.state].filter(Boolean).join(', ');
  return (
    <header className="site-header">
      <h2 id={titleId} className="site-header__title" tabIndex={-1}>
        <span className={`type-chip type-chip--${details.report_type}`}>
          <TypeIcon type={details.report_type} size={32} />
        </span>
        {t(`reportType.${details.report_type}`)}
      </h2>
      <p className="site-header__meta">
        <StatusBadge status={details.status} />
        <span>{t(`verification.${details.verification}`)}</span>
        {distance && <span>{distance}</span>}
      </p>
      <p className="site-header__context">
        {t(`context.${details.context}`)} · {place}
      </p>
      <SiteBadges badges={presenter.badges()} />
    </header>
  );
}
