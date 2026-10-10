import type { WardScores } from "../contracts/index.gen.js";
import { mean } from "./scoreUtils.js";

// City list order: areas with a shown score first, lowest mean shown score first, then most verified reports, then id.
export class AreaRanking {
  readonly #rows: readonly WardScores[];

  constructor(rows: readonly WardScores[]) {
    this.#rows = [...rows].sort((a, b) => AreaRanking.#compare(a, b));
  }

  get total(): number {
    return this.#rows.length;
  }

  top(limit: number): WardScores[] {
    return this.#rows.slice(0, limit);
  }

  // Mean of the shown scores only, so a withheld score never ranks; null when none is shown.
  static shownMean(row: WardScores): number | null {
    if (row.counts.verified_reports < row.min_verified_reports) {
      return null;
    }
    const { city, citizen, bin_access } = row.scores;
    return mean([city.value, citizen.value, bin_access.value]);
  }

  static #compare(a: WardScores, b: WardScores): number {
    const left = AreaRanking.shownMean(a);
    const right = AreaRanking.shownMean(b);
    if (left === null || right === null) {
      return Number(left === null) - Number(right === null) || AreaRanking.#byReports(a, b);
    }
    return left - right || AreaRanking.#byReports(a, b);
  }

  static #byReports(a: WardScores, b: WardScores): number {
    return b.counts.verified_reports - a.counts.verified_reports || a.area.id.localeCompare(b.area.id);
  }
}
