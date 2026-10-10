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
  /** What the score is, or why there is none: "not enough reports (n of 10)" already holds the count. */
  readonly note: string;
  /** The verified report count, or null when the note already gives it. */
  readonly reports: string | null;
  /** The note, then the count when the note does not already give it: the row's one line under the name. */
  readonly meta: string;
  /** Pilot-city data (Jodhpur), flagged beside the score as on the area page. */
  readonly pilot: boolean;
  /** The area has the 10 verified reports a letter needs. */
  readonly letterReady: boolean;
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
    const note = this.#note(standing);
    const reports = this.#tooFew(standing) ? null : this.#t('ranking.reports', { n });
    return {
      key: `${standing.row.area.kind}/${standing.id}`,
      id: standing.id,
      rank: rank === null ? null : this.#format.number(rank),
      name: standing.name,
      score: score === null ? null : this.#format.number(score),
      note,
      reports,
      meta: reports ? `${note} · ${reports}` : note,
      pilot: standing.row.pilot,
      letterReady: standing.letterReady,
    };
  }

  #note(standing: RankedArea['standing']): string {
    if (standing.scored) return this.#t('ranking.meanOf', { k: this.#format.number(standing.shown.length) });
    const n = this.#format.number(standing.reports);
    // Enough reports but nothing measurable yet (no_data), versus too few reports.
    if (!this.#tooFew(standing)) return this.#t('ranking.noData', { n });
    return this.#t('ranking.notEnough', { n, min: this.#format.number(standing.minReports) });
  }

  #tooFew(standing: RankedArea['standing']): boolean {
    return !standing.scored && standing.reports < standing.minReports;
  }
}
