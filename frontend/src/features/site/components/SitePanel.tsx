import { useState } from 'react';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { SiteNotes } from '../../community/components/SiteNotes';
import { VoteBox } from '../../community/components/VoteBox';
import { useSitePresenter } from '../hooks/useSitePresenter';
import '../site.css';
import { SiteActions } from './SiteActions';
import { SiteBackersBar } from './SiteBackersBar';
import { SiteBrands } from './SiteBrands';
import { SiteClearance } from './SiteClearance';
import { SiteCounts } from './SiteCounts';
import { SiteExpiryNote } from './SiteExpiryNote';
import { SiteReporters } from './SiteReporters';
import { SiteHistoryFacts } from './SiteHistoryFacts';
import { SiteLocationFacts } from './SiteLocationFacts';
import { SiteLocationLine } from './SiteLocationLine';
import { SitePanelHeader } from './SitePanelHeader';
import { SitePhotoStrip } from './SitePhotoStrip';
import { WithdrawReport } from './WithdrawReport';

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
  // An unverified site shows the vote straight away; others after Confirm. The server refuses its own reporters.
  const [voting, setVoting] = useState(details.verification === 'unverified');
  // An expired site takes no vote, cleanup, letter or withdrawal (decision 20261010-1855), so it shows no actions.
  const active = details.status !== 'expired';
  return (
    <article className="site-panel">
      <SitePanelHeader site={site} titleId={SITE_TITLE_ID} userLocation={userLocation} presenter={presenter} />
      <SiteBackersBar backers={details.backers} />
      <SiteClearance site={details} onChanged={() => onChanged?.()} />
      <SiteExpiryNote site={details} />
      {active && <SiteActions site={site} primary={presenter.primaryAction()} onConfirm={() => setVoting(true)} />}
      {active && voting && <VoteBox siteId={details.site_id} onVoted={() => onChanged?.()} noBin={details.report_type === 'no_bin'} />}
      {active && <WithdrawReport site={details} onChanged={() => onChanged?.()} />}
      <SitePhotoStrip photos={presenter.photos()} />
      <SiteLocationLine location={details.location} />
      <SiteCounts reports={details.report_count} verified={details.verified_count} />
      <SiteReporters site={details} />
      <SiteNotes siteId={details.site_id} community={details.community} onChanged={() => onChanged?.()} />
      <SiteLocationFacts location={details.location} />
      <SiteBrands brands={details.brands} />
      <SiteHistoryFacts site={details} />
    </article>
  );
}
