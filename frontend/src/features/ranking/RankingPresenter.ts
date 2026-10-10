import type { RankedArea } from '../../domain/AreaRanking';
import type { LocaleFormatter } from '../../i18n/LocaleFormatter';
import type { Translate } from '../areas/AreaPresenter';

export interface RankingRowView {
  readonly key: string;
  /** Area id, for the area page link. */
  readonly id: string;
  readonly rank: string | null;
  readonly name: string;
  /** "41/100" style text, or null while every score is withheld. */
  readonly score: string | null;
  /** What the score is and how many reports it rests on, or "not enough reports (n of 10)". */
  readonly note: string;
  readonly reports: string;
}

/** Row texts for the city ranking: a score always beside its count; a withheld score never shows. */
export class RankingPresenter {
  readonly #t: Translate;
  readonly #format: LocaleFormatter;

  constructor(translate: Translate, format: LocaleFormatter) {
    this.#t = translate;
    this.#format = format;
  }

  row({ rank, standing }: RankedArea): RankingRowView {
    const n = this.#format.number(standing.reports);
    const score = standing.score;
    return {
      key: `${standing.row.area.kind}/${standing.id}`,
      id: standing.id,
      rank: rank === null ? null : this.#format.number(rank),
      name: standing.name,
      score: score === null ? null : this.#format.number(score),
      note: this.#note(standing),
      reports: this.#t('ranking.reports', { n }),
    };
  }

  #note(standing: RankedArea['standing']): string {
    if (standing.scored) return this.#t('ranking.meanOf', { k: this.#format.number(standing.shown.length) });
    const n = this.#format.number(standing.reports);
    // Enough reports but nothing measurable yet (no_data), versus too few reports.
    if (standing.reports >= standing.minReports) return this.#t('ranking.noData', { n });
    return this.#t('ranking.notEnough', { n, min: this.#format.number(standing.minReports) });
  }
}
