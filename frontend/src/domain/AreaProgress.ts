import type { AreaScores } from './AreaScores';
import { AreaStanding } from './AreaStanding';

/**
 * none: no row, so no site was ever reported there; few: a row below the threshold, every score withheld (or its
 * sites since cleared, expired or withdrawn); withheld: enough verified reports, but the api still withholds every
 * score (no_data); scored: a shown score.
 */
export type AreaStage = 'none' | 'few' | 'withheld' | 'scored';

/**
 * Where an area stands for a list row or the map card, from its scores row or from no row at all.
 * No row means no site has landed there (the worker seeds a row with the first site), so every count is 0.
 * A score is the mean of the shown scores, never a guess, and only from min_verified_reports up.
 */
export class AreaProgress {
  readonly stage: AreaStage;
  readonly sites: number;
  readonly verified: number;
  readonly min: number;
  readonly score: number | null;

  private constructor(stage: AreaStage, row: AreaScores | null, score: number | null, fallbackMin: number) {
    this.stage = stage;
    this.sites = row?.counts.sites ?? 0;
    this.verified = row?.counts.verified_reports ?? 0;
    this.min = row?.min_verified_reports ?? fallbackMin;
    this.score = score;
  }

  /**
   * fallbackMin is the api's own threshold (MIN_VERIFIED_REPORTS, mirrored in the config's SiteRules), used only when
   * there is no row to read ward_scores.min_verified_reports from.
   */
  static of(row: AreaScores | null, fallbackMin: number): AreaProgress {
    if (!row) return new AreaProgress('none', null, null, fallbackMin);
    const standing = new AreaStanding(row);
    return new AreaProgress(AreaProgress.#stage(standing), row, standing.score, fallbackMin);
  }

  static #stage(standing: AreaStanding): AreaStage {
    if (standing.score !== null) return 'scored';
    return standing.reports >= standing.minReports ? 'withheld' : 'few';
  }
}
