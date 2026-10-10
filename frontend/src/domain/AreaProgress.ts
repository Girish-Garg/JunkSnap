import type { AreaScores } from './AreaScores';
import { AreaStanding } from './AreaStanding';

// The api's own threshold (ward_scores.min_verified_reports); used only when there is no row to read it from.
const MIN_VERIFIED_REPORTS = 10;

/**
 * none: no row, so no site was ever reported there; few: a row with every score withheld (below the threshold,
 * or its sites since cleared, expired or withdrawn); scored: a shown score.
 */
export type AreaStage = 'none' | 'few' | 'scored';

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

  private constructor(stage: AreaStage, row: AreaScores | null, score: number | null) {
    this.stage = stage;
    this.sites = row?.counts.sites ?? 0;
    this.verified = row?.counts.verified_reports ?? 0;
    this.min = row?.min_verified_reports ?? MIN_VERIFIED_REPORTS;
    this.score = score;
  }

  static of(row: AreaScores | null): AreaProgress {
    if (!row) return new AreaProgress('none', null, null);
    const score = new AreaStanding(row).score;
    return new AreaProgress(score === null ? 'few' : 'scored', row, score);
  }
}
