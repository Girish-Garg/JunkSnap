import type { AreaScores } from '../../domain/AreaScores';
import { AreaStanding } from '../../domain/AreaStanding';

export type FillBasis = 'score' | 'count';

export interface AreaFill {
  readonly basis: FillBasis;
  /** Index into the basis ramp; 0 is the lightest. */
  readonly step: number;
  readonly color: string;
}

export interface LegendStep {
  readonly color: string;
  /** Lower bound of the step: a score, or a number of verified reports. */
  readonly from: number;
}

// One hue each, darker = more to act on; no red-to-green traffic light and no party colours.
// Scores: lower is worse, so the darkest step is 0 to 19.
const SCORE_STEPS: readonly LegendStep[] = [
  { from: 80, color: '#fbe3df' },
  { from: 60, color: '#f2b5aa' },
  { from: 40, color: '#e2786a' },
  { from: 20, color: '#c5221f' },
  { from: 0, color: '#8c1412' },
];

// Report counts while the score is withheld: neutral greys, so a count never reads as a score.
const COUNT_STEPS: readonly LegendStep[] = [
  { from: 1, color: '#e8eaed' },
  { from: 3, color: '#c4c7c5' },
  { from: 6, color: '#9aa0a6' },
  { from: 10, color: '#6f7479' },
];

/** Colours an area by its shown score, else by its verified report count; no reports, no fill. */
export class ChoroplethScale {
  static readonly scoreSteps = SCORE_STEPS;
  static readonly countSteps = COUNT_STEPS;

  static fill(row: AreaScores): AreaFill | null {
    const standing = new AreaStanding(row);
    if (standing.score !== null) {
      const step = SCORE_STEPS.findIndex((candidate) => (standing.score ?? 0) >= candidate.from);
      return { basis: 'score', step, color: ChoroplethScale.#color(SCORE_STEPS, step) };
    }
    if (standing.reports <= 0) return null;
    const step = COUNT_STEPS.findLastIndex((candidate) => standing.reports >= candidate.from);
    return { basis: 'count', step, color: ChoroplethScale.#color(COUNT_STEPS, step) };
  }

  /**
   * Area id to score colour, for the map's feature state: only areas that show a score (10+ verified reports).
   * Every other area keeps its neighbour tint, so a report count is never read as a colour on the map; the
   * marker carries the count.
   */
  static colors(rows: readonly AreaScores[]): ReadonlyMap<string, string> {
    const colors = new Map<string, string>();
    for (const row of rows) {
      const fill = ChoroplethScale.fill(row);
      if (fill?.basis === 'score') colors.set(row.area.id, fill.color);
    }
    return colors;
  }

  static #color(steps: readonly LegendStep[], step: number): string {
    return steps[step]?.color ?? 'transparent';
  }
}
