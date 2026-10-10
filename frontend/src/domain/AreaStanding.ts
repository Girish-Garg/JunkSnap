import type { AreaScores, ScoreName } from './AreaScores';

const SCORE_NAMES: readonly ScoreName[] = ['city', 'citizen', 'bin_access'];

/**
 * Where an area stands for the map fill and the ranking: the mean of its shown scores, the same measure the
 * area list route ranks by (area_list.schema.json), else only its verified report count.
 * Nothing shows below min_verified_reports verified reports, whatever the row says.
 */
export class AreaStanding {
  readonly row: AreaScores;

  constructor(row: AreaScores) {
    this.row = row;
  }

  get id(): string {
    return this.row.area.id;
  }

  get name(): string {
    return this.row.area.name;
  }

  get reports(): number {
    return this.row.counts.verified_reports;
  }

  get minReports(): number {
    return this.row.min_verified_reports;
  }

  /** The api drafts an area letter only from 10 verified reports (409 not_verified below; the issue may need more). */
  get letterReady(): boolean {
    return this.reports >= this.minReports;
  }

  /** The scores the api shows; empty while every score is withheld. */
  get shown(): readonly ScoreName[] {
    if (this.reports < this.minReports) return [];
    return SCORE_NAMES.filter((name) => {
      const score = this.row.scores[name];
      return score.value !== null && score.reason === null;
    });
  }

  /** Mean of the shown scores, rounded; null when withheld. Never a guess. */
  get score(): number | null {
    const shown = this.shown;
    if (shown.length === 0) return null;
    const total = shown.reduce((sum, name) => sum + (this.row.scores[name].value ?? 0), 0);
    return Math.round(total / shown.length);
  }

  get scored(): boolean {
    return this.score !== null;
  }
}
