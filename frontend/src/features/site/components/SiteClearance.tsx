import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { SiteLifecycle } from '../../../domain/SiteLifecycle';
import { Button } from '../../../ui/Button';
import { useVote } from '../../community/hooks/useVote';
import '../clearance.css';

interface SiteClearanceProps {
  readonly site: SiteProperties;
  /** Called after a vote, so the sheet reads the site again. */
  readonly onChanged: () => void;
}

const TITLE_ID = 'clearance-title';

/** "2 of 3 people say it's cleared": shown while a site waits for more people to agree (decision 20261010-1855). */
export function SiteClearance({ site, onChanged }: SiteClearanceProps) {
  const { t } = useTranslation();
  const vote = useVote(site.site_id, onChanged);
  const pending = new SiteLifecycle(site).pendingClearance();
  if (!pending) return null;
  const { count, needed } = pending;
  return (
    <section className="clearance" aria-labelledby={TITLE_ID}>
      <div className="clearance__head">
        <h3 id={TITLE_ID} className="clearance__title">{t('clearance.title')}</h3>
        <span className="clearance__progress">{t('clearance.progress', { count, needed })}</span>
      </div>
      <progress className="clearance__bar" max={needed} value={Math.min(count, needed)} aria-label={t('clearance.progress', { count, needed })} />
      <p className="clearance__text">{t('clearance.text', { needed })}</p>
      <div className="clearance__buttons">
        <Button onClick={() => vote.vote('cleaned')} disabled={vote.busy}>
          {t('clearance.cleared')}
        </Button>
        <Button variant="secondary" onClick={() => vote.vote('confirm')} disabled={vote.busy}>
          {t('clearance.stillThere')}
        </Button>
      </div>
      {vote.problem && (
        <p className="form__error" role="alert">
          {t(`vote.errors.${vote.problem}`)}
        </p>
      )}
    </section>
  );
}
