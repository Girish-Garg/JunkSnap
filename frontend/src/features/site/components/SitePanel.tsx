import type { LonLat, SiteFeature } from '../../../domain/Site';
import { useSitePresenter } from '../hooks/useSitePresenter';
import '../site.css';
import { SiteActions } from './SiteActions';
import { SiteBrands } from './SiteBrands';
import { SiteCounts } from './SiteCounts';
import { SiteHistoryFacts } from './SiteHistoryFacts';
import { SiteLocationFacts } from './SiteLocationFacts';
import { SiteLocationLine } from './SiteLocationLine';
import { SitePanelHeader } from './SitePanelHeader';
import { SitePhotoStrip } from './SitePhotoStrip';

export const SITE_TITLE_ID = 'site-panel-title';

interface SitePanelProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
}

// Order is progressive disclosure: peek shows the header, half adds the next four, full adds the rest.
export function SitePanel({ site, userLocation }: SitePanelProps) {
  const details = site.properties;
  const presenter = useSitePresenter(details);
  return (
    <article className="site-panel">
      <SitePanelHeader site={site} titleId={SITE_TITLE_ID} userLocation={userLocation} presenter={presenter} />
      <SiteActions site={site} primary={presenter.primaryAction()} />
      <SitePhotoStrip photos={presenter.photos()} />
      <SiteLocationLine location={details.location} />
      <SiteCounts reports={details.report_count} verified={details.verified_count} />
      <SiteLocationFacts location={details.location} />
      <SiteBrands brands={details.brands} />
      <SiteHistoryFacts site={details} />
    </article>
  );
}
