import { useTranslation } from 'react-i18next';
import type { BoundaryKind } from '../../../domain/AreaListing';
import { Notice } from '../../../ui/Notice';
import { Skeleton } from '../../../ui/Skeleton';
import type { RankingState } from '../hooks/useRanking';
import { RankingRow } from './RankingRow';

interface RankingListProps {
  readonly kind: BoundaryKind;
  readonly state: RankingState;
}

export function RankingList({ kind, state }: RankingListProps) {
  const { t } = useTranslation();
  if (state.failed) return <Notice icon="info" text={t('ranking.loadFailed')} tone="alert" />;
  if (!state.rows) {
    return (
      <div className="ranking-skeleton" role="status" aria-label={t('ranking.loading')}>
        <Skeleton height="56px" />
        <Skeleton height="56px" />
        <Skeleton height="56px" />
      </div>
    );
  }
  if (state.rows.length === 0) return <p className="sheet-text">{t('ranking.empty')}</p>;
  return (
    <>
      <ol className="ranking-list" aria-label={t('ranking.listLabel')}>
        {state.rows.map((row) => (
          <RankingRow key={row.key} kind={kind} row={row} />
        ))}
      </ol>
      <p className="ranking-footnote">{t('ranking.footnote', { shown: String(state.rows.length), total: String(state.total) })}</p>
    </>
  );
}
