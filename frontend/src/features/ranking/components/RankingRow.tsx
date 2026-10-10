import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { areaPath } from '../../../app/paths';
import type { BoundaryKind } from '../../../domain/AreaListing';
import { AreaLetterButton } from '../../areas/components/AreaLetterButton';
import type { RankingRowView } from '../RankingPresenter';

interface RankingRowProps {
  readonly kind: BoundaryKind;
  readonly row: RankingRowView;
}

/** Rank, name, score with what it rests on (or why there is none), verified reports; opens the area page. */
export function RankingRow({ kind, row }: RankingRowProps) {
  const { t } = useTranslation();
  return (
    <li>
      <Link className="ranking-row" to={areaPath(kind, row.id)}>
        <span className="ranking-row__rank" aria-label={row.rank ? t('ranking.rank', { n: row.rank }) : t('ranking.unranked')}>
          {row.rank ?? '–'}
        </span>
        <span className="ranking-row__text">
          <span className="ranking-row__name">{row.name}</span>
          <span className="ranking-row__meta">
            {row.note} · {row.reports}
          </span>
        </span>
        <span className="ranking-row__score">
          {row.score === null ? (
            <span className="ranking-row__withheld">{t('areas.withheld')}</span>
          ) : (
            <>
              <strong>{row.score}</strong>
              <span className="ranking-row__of">/100</span>
            </>
          )}
        </span>
      </Link>
      <AreaLetterButton kind={kind} areaId={row.id} short />
    </li>
  );
}
