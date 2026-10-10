import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { areaPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
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
  const { linkState } = useSheetNavigation();
  return (
    <li>
      <Link className="ranking-row" to={areaPath(kind, row.id)} state={linkState}>
        <span className="ranking-row__rank" aria-label={row.rank ? t('ranking.rank', { n: row.rank }) : t('ranking.unranked')}>
          {row.rank ?? '–'}
        </span>
        <span className="ranking-row__text">
          <span className="ranking-row__name">{row.name}</span>
          <span className="ranking-row__meta">{row.meta}</span>
          {row.pilot && <span className="badge ranking-row__pilot">{t('site.pilot')}</span>}
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
      <AreaLetterButton kind={kind} areaId={row.id} ready={row.letterReady} short />
    </li>
  );
}
