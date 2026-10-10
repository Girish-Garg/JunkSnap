import type { LonLat, SiteFeature } from '../../../domain/Site';
import { SiteNotes } from '../../community/components/SiteNotes';
import { useSitePresenter } from '../hooks/useSitePresenter';
import '../site.css';
import { SiteBackersBar } from './SiteBackersBar';
import { SiteBrands } from './SiteBrands';
import { SiteClearance } from './SiteClearance';
import { SiteClosedNote } from './SiteClosedNote';
import { SiteCounts } from './SiteCounts';
import { SiteExpiryNote } from './SiteExpiryNote';
import { SiteReporters } from './SiteReporters';
import { SiteHistoryFacts } from './SiteHistoryFacts';
import { SiteLocationFacts } from './SiteLocationFacts';
import { SiteOpenActions } from './SiteOpenActions';
import { SitePanelHeader } from './SitePanelHeader';

export const SITE_TITLE_ID = 'site-panel-title';

interface SitePanelProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
  /** Called after a vote, so the sheet reads the site again. */
  readonly onChanged?: () => void;
}

// Order is progressive disclosure: the header (photos, title, status, ward and seats), the backers, the actions in
// one row, then one card per section. A site off the map (removed, cleaned, rejected, expired) shows why instead
// of votes, actions and notes; an open one shows the clearing progress and its expiry first (decision 20261010-1855).
export function SitePanel({ site, userLocation, onChanged }: SitePanelProps) {
  const details = site.properties;
  const presenter = useSitePresenter(details);
  const closed = presenter.closedReason();
  const changed = () => onChanged?.();
  return (
    <article className="site-panel">
      <SitePanelHeader site={site} titleId={SITE_TITLE_ID} userLocation={userLocation} presenter={presenter} />
      {presenter.showsBackers() && <SiteBackersBar backers={details.backers} />}
      {closed ? (
        <SiteClosedNote reason={closed} />
      ) : (
        <>
          <SiteClearance site={details} onChanged={changed} />
          <SiteExpiryNote site={details} />
          <SiteOpenActions site={site} presenter={presenter} onChanged={changed} />
        </>
      )}
      <SiteCounts reports={details.report_count} verified={details.verified_count} />
      <SiteReporters site={details} />
      {!closed && <SiteNotes siteId={details.site_id} community={details.community} onChanged={changed} />}
      <SiteLocationFacts location={details.location} />
      <SiteBrands brands={details.brands} />
      <SiteHistoryFacts site={details} />
    </article>
  );
}
