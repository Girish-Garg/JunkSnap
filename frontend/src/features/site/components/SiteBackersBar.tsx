import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { SiteStatusChip } from '../../../domain/SiteStatusChip';
import '../backers.css';
import { useSitePresenter } from '../hooks/useSitePresenter';
import { AskNeighboursButton } from './AskNeighboursButton';
import { ExplainButton } from './ExplainButton';

interface SiteBackersBarProps {
  readonly site: SiteProperties;
}

/**
 * "n of 10 people confirmed": photos and yes votes, each person once (decision 20261010-1530). A tap on the count
 * says what it means; while the site waits for its people, Ask neighbours to confirm sits under the bar.
 */
export function SiteBackersBar({ site }: SiteBackersBarProps) {
  const { t } = useTranslation();
  const asks = useSitePresenter(site).waitsForBackers();
  const { count, needed, photo_people: photos, vote_people: votes } = site.backers;
  const done = count >= needed;
  const label = done ? t('backers.done', { count }) : t('backers.label', { count, needed });
  return (
    <section className={done ? 'backers backers--done' : 'backers'} aria-label={label}>
      <div className="backers__head">
        <ExplainButton site={site} chip={SiteStatusChip.backing(site)} className="backers__label">
          {label}
        </ExplainButton>
        <span className="backers__detail">{t('backers.detail', { photos, votes })}</span>
      </div>
      <progress className="backers__bar" max={needed} value={Math.min(count, needed)} />
      {asks && <AskNeighboursButton site={site} />}
    </section>
  );
}
