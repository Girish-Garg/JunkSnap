import type { AreaScores } from './AreaScores';
import { AreaStanding } from './AreaStanding';

export interface RankedArea {
  /** 1 is the worst; null for areas without a shown score, which are never ranked. */
  readonly rank: number | null;
  readonly standing: AreaStanding;
}

/**
 * Numbers the area list route's rows, which come worst first (area_list.schema.json): scored areas by lowest
 * mean of the shown scores, then the areas with every score withheld. Keeps the api's order; no history.
 */
export class AreaRanking {
  static of(rows: readonly AreaScores[]): readonly RankedArea[] {
    let next = 1;
    return rows.map((row) => {
      const standing = new AreaStanding(row);
      return { rank: standing.scored ? next++ : null, standing };
    });
  }

  /** The api's order, for the mock: lowest mean score first, then withheld; more reports, then id, on a tie. */
  static compare(a: AreaScores, b: AreaScores): number {
    const left = new AreaStanding(a);
    const right = new AreaStanding(b);
    const byScore = AreaRanking.#scoreKey(left) - AreaRanking.#scoreKey(right);
    return byScore || right.reports - left.reports || left.id.localeCompare(right.id);
  }

  static #scoreKey(standing: AreaStanding): number {
    const shown = standing.shown;
    if (shown.length === 0) return Number.POSITIVE_INFINITY;
    return shown.reduce((sum, name) => sum + (standing.row.scores[name].value ?? 0), 0) / shown.length;
  }
}
