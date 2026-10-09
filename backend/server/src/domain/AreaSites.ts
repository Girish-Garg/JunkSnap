import type { WardScores } from "../contracts/index.gen.js";
import type { AreaSite } from "./AreaSite.js";
import { sum } from "./scoreUtils.js";

// The sites of one area; rejected sites never count, metrics read verified sites only.
export class AreaSites {
  readonly #all: readonly AreaSite[];

  constructor(sites: readonly AreaSite[]) {
    this.#all = sites;
  }

  counted(): readonly AreaSite[] {
    return this.#all.filter((site) => site.isCounted());
  }

  verified(): readonly AreaSite[] {
    return this.#all.filter((site) => site.isVerified());
  }

  // The sites behind the area insights: verified, with at least one verified report.
  withVerifiedReports(): readonly AreaSite[] {
    return this.verified().filter((site) => site.verifiedReports() > 0);
  }

  verifiedReports(): number {
    return sum(this.verified().map((site) => site.verifiedReports()));
  }

  noBinReports(): number {
    return sum(this.verified().filter((site) => site.isType("no_bin")).map((site) => site.verifiedReports()));
  }

  isPilot(): boolean {
    return this.#all.some((site) => site.isPilot());
  }

  earliestReport(): string | null {
    const times = this.counted().map((site) => site.firstReportedAt);
    const sorted = times.sort((a, b) => Date.parse(a) - Date.parse(b));
    return sorted[0] ?? null;
  }

  counts(): WardScores["counts"] {
    const counted = this.counted();
    return {
      verified_reports: this.verifiedReports(),
      no_bin_reports: this.noBinReports(),
      sites: counted.length,
      open_sites: counted.filter((site) => site.hasStatus("open")).length,
      cleaned_sites: counted.filter((site) => site.hasStatus("cleaned")).length,
      reopened_sites: counted.filter((site) => site.hasStatus("reopened")).length,
    };
  }
}
