import { AREA_ISSUES, type AreaIssue } from './AreaLetter';
import type { AreaCounts } from './AreaScores';
import type { SiteProperties } from './Site';

/** An issue's verified reports as far as the app can tell: at least `seen`, at most `most`; exact when the two meet. */
export interface IssueCount {
  readonly issue: AreaIssue;
  readonly seen: number;
  readonly most: number;
}

export type TalliedSite = Pick<SiteProperties, 'report_type' | 'verification' | 'status' | 'verified_count'>;

// The api counts the verified_count of the area's verified sites of the issue; removed and expired sites never count.
const counts = (site: TalliedSite) => site.verification === 'verified' && site.status !== 'removed' && site.status !== 'expired';

/**
 * Verified reports per area letter issue. The area's scores give every verified report and the no-bin ones; the rest
 * come by type from the area's sites loaded on the map, which can miss some (cleaned, or out of view). So a type's
 * count is a range: what the map shows, up to that plus the verified reports the map does not show. Never a guess.
 */
export class AreaIssueTally {
  readonly min: number;
  readonly #byType = new Map<string, number>();
  readonly #all: number;
  readonly #noBin: number;
  readonly #unseen: number;

  constructor(area: Pick<AreaCounts, 'verified_reports' | 'no_bin_reports'>, min: number, sites: readonly TalliedSite[]) {
    for (const site of sites.filter(counts)) this.#byType.set(site.report_type, (this.#byType.get(site.report_type) ?? 0) + site.verified_count);
    this.#noBin = Math.max(area.no_bin_reports, this.#byType.get('no_bin') ?? 0);
    const mapped = [...this.#byType].reduce((sum, [type, n]) => sum + (type === 'no_bin' ? 0 : n), this.#noBin);
    this.#all = Math.max(area.verified_reports, mapped);
    this.#unseen = this.#all - mapped;
    this.min = min;
  }

  count(issue: AreaIssue): IssueCount {
    if (issue === 'all') return { issue, seen: this.#all, most: this.#all };
    if (issue === 'no_bin') return { issue, seen: this.#noBin, most: this.#noBin };
    const seen = this.#byType.get(issue) ?? 0;
    return { issue, seen, most: seen + this.#unseen };
  }

  counts(): readonly IssueCount[] {
    return AREA_ISSUES.map((issue) => this.count(issue));
  }

  /**
   * The report type with the most verified reports, when it surely has enough; else every issue at once; else the
   * type that may still have enough; null when no issue can reach min (the sheet is locked then).
   */
  pick(): AreaIssue | null {
    const types = this.counts().filter((count) => count.issue !== 'all' && count.most >= this.min);
    const top = types.reduce<IssueCount | null>((best, count) => (best && best.seen >= count.seen ? best : count), null);
    if (top && top.seen >= this.min) return top.issue;
    return this.#all >= this.min ? 'all' : (top?.issue ?? null);
  }
}
