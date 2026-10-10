import { useTranslation } from 'react-i18next';
import type { SiteBackers } from '../../../domain/Site';
import '../backers.css';

interface SiteBackersBarProps {
  readonly backers: SiteBackers;
}

/** "n of 10 people confirmed": photos and yes votes, each person once (decision 20261010-1530). */
export function SiteBackersBar({ backers }: SiteBackersBarProps) {
  const { t } = useTranslation();
  const { count, needed, photo_people: photos, vote_people: votes } = backers;
  const done = count >= needed;
  const label = done ? t('backers.done', { count }) : t('backers.label', { count, needed });
  return (
    <section className={done ? 'backers backers--done' : 'backers'} aria-label={label}>
      <div className="backers__head">
        <span className="backers__label">{label}</span>
        <span className="backers__detail">{t('backers.detail', { photos, votes })}</span>
      </div>
      <progress className="backers__bar" max={needed} value={Math.min(count, needed)} />
    </section>
  );
}
