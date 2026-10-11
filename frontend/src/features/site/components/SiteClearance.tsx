import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import type { GatedAction } from '../../actions/GatedAction';
import { SiteLifecycle } from '../../../domain/SiteLifecycle';
import '../clearance.css';
import { ClearanceVotes } from './ClearanceVotes';

interface SiteClearanceProps {
  readonly site: SiteProperties;
  /** Whether this person can vote here (useSiteGates). */
  readonly vote: GatedAction;
  /** Called after a vote, so the sheet reads the site again. */
  readonly onChanged: () => void;
}

const TITLE_ID = 'clearance-title';

/** "2 of 3 people say it's cleared": shown while a site waits for more people to agree (decision 20261010-1855). */
export function SiteClearance({ site, vote, onChanged }: SiteClearanceProps) {
  const { t } = useTranslation();
  const pending = new SiteLifecycle(site).pendingClearance();
  if (!pending) return null;
  const { count, needed } = pending;
  const noBin = site.report_type === 'no_bin';
  const words = noBin ? 'clearance.noBin' : 'clearance';
  return (
    <section className="clearance" aria-labelledby={TITLE_ID}>
      <div className="clearance__head">
        <h3 id={TITLE_ID} className="clearance__title">{t(`${words}.title`)}</h3>
        <span className="clearance__progress">{t(`${words}.progress`, { count, needed })}</span>
      </div>
      <progress className="clearance__bar" max={needed} value={Math.min(count, needed)} aria-label={t(`${words}.progress`, { count, needed })} />
      <p className="clearance__text">{t(`${words}.text`, { needed })}</p>
      <ClearanceVotes siteId={site.site_id} gated={vote} onChanged={onChanged} noBin={noBin} />
    </section>
  );
}
