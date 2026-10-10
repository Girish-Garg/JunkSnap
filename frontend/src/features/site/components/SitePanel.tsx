import { useState } from 'react';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { VoteBox } from '../../community/components/VoteBox';
import { useSitePresenter } from '../hooks/useSitePresenter';
import '../site.css';
import { SiteActions } from './SiteActions';
import { SiteBrands } from './SiteBrands';
import { SiteCounts } from './SiteCounts';
import { SiteReporters } from './SiteReporters';
import { SiteHistoryFacts } from './SiteHistoryFacts';
import { SiteLocationFacts } from './SiteLocationFacts';
import { SiteLocationLine } from './SiteLocationLine';
import { SitePanelHeader } from './SitePanelHeader';
import { SitePhotoStrip } from './SitePhotoStrip';

export const SITE_TITLE_ID = 'site-panel-title';

interface SitePanelProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
  /** Called after a vote, so the sheet reads the site again. */
  readonly onChanged?: () => void;
}

// Order is progressive disclosure: peek shows the header, half adds the next four, full adds the rest.
export function SitePanel({ site, userLocation, onChanged }: SitePanelProps) {
  const details = site.properties;
  const presenter = useSitePresenter(details);
  // A site waiting for neighbours shows the vote straight away; others after Confirm.
  const [voting, setVoting] = useState(details.verification === 'community_check');
  return (
    <article className="site-panel">
      <SitePanelHeader site={site} titleId={SITE_TITLE_ID} userLocation={userLocation} presenter={presenter} />
      <SiteActions site={site} primary={presenter.primaryAction()} onConfirm={() => setVoting(true)} />
      {voting && <VoteBox siteId={details.site_id} onVoted={() => onChanged?.()} />}
      <SitePhotoStrip photos={presenter.photos()} />
      <SiteLocationLine location={details.location} />
      <SiteCounts reports={details.report_count} verified={details.verified_count} />
      <SiteReporters site={details} />
      <SiteLocationFacts location={details.location} />
      <SiteBrands brands={details.brands} />
      <SiteHistoryFacts site={details} />
    </article>
  );
}
