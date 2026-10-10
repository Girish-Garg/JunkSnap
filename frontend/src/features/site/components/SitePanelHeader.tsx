import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { TypeIcon } from '../../../ui/TypeIcon';
import { useSiteDistance } from '../hooks/useSiteDistance';
import type { SitePresenter } from '../SitePresenter';
import { SiteBadges } from './SiteBadges';
import { SiteHeaderPhotos } from './SiteHeaderPhotos';
import { SiteLocationLine } from './SiteLocationLine';
import { StatusChip } from './StatusChip';

interface SitePanelHeaderProps {
  readonly site: SiteFeature;
  readonly titleId: string;
  readonly userLocation: LonLat | null;
  readonly presenter: SitePresenter;
}

/**
 * Like a map app's place sheet: the title, the status chip with the distance and where it is (ward, MLA seat, MP seat)
 * and badges come first, so the half-open sheet shows them; then the photo carousel with its count and Add a photo.
 */
export function SitePanelHeader({ site, titleId, userLocation, presenter }: SitePanelHeaderProps) {
  const { t } = useTranslation();
  const details = site.properties;
  const distance = useSiteDistance(site, userLocation);
  const place = [details.location.town, details.location.state].filter(Boolean).join(', ');
  return (
    <header className="site-header">
      <h2 id={titleId} className="site-header__title" tabIndex={-1}>
        <span className={`type-chip type-chip--small type-chip--${details.report_type}`}>
          <TypeIcon type={details.report_type} size={22} />
        </span>
        {t(`reportType.${details.report_type}`)}
      </h2>
      <p className="site-header__meta">
        <StatusChip site={details} />
        {presenter.showsVerification() && <span>{t(`verification.${details.verification}`)}</span>}
        {distance && <span>{distance.label}</span>}
      </p>
      <SiteLocationLine location={details.location} />
      <p className="site-header__context">
        {t(`context.${details.context}`)} · {place}
      </p>
      <SiteBadges badges={presenter.badges()} />
      <SiteHeaderPhotos site={site} photos={presenter.photos()} userLocation={userLocation} />
    </header>
  );
}
