import type { MergeableReport } from "./MergeableReport.js";
import type { Site } from "./Site.js";
import { olderFirst } from "./utils.js";

// The open sites a report may join (Site.accepts: its type, within the merge radius, not rejected, removed or expired),
// nearest first and the oldest on a tie (decision 20261011-1610-hem-same-spot-merge).
export class MergeCandidates {
  readonly #report: MergeableReport;
  readonly #sameSpotM: number;
  readonly #open: readonly Site[];

  constructor(report: MergeableReport, nearby: readonly Site[], sameSpotM: number) {
    this.#report = report;
    this.#sameSpotM = sameSpotM;
    const distance = (site: Site) => site.point.distanceTo(report.point);
    this.#open = nearby.filter((site) => site.accepts(report)).sort((a, b) => distance(a) - distance(b) || olderFirst(a, b));
  }

  open(): readonly Site[] {
    return this.#open;
  }

  // The site the reporter chose with Me too (decision 20261011-0339), when it is open to the report.
  meToo(): Site | null {
    return this.#open.find((site) => site.siteId === this.#report.meTooSiteId) ?? null;
  }

  // Every open site but the Me too one, nearest first.
  others(): readonly Site[] {
    return this.#open.filter((site) => site.siteId !== this.#report.meTooSiteId);
  }

  // Within sameSpotM a site takes the report whatever the photos look like. A long-range pin can be dropped anywhere,
  // so it still needs a matching photo (decision 20261011-0400); no-bin zones keep their nearest-zone rule (-1630).
  atSameSpot(site: Site): boolean {
    const { longRange, reportType, point } = this.#report;
    return !longRange && reportType !== "no_bin" && site.point.distanceTo(point) <= this.#sameSpotM;
  }

  // The nearest open site at the same spot, the Me too site aside.
  sameSpot(): Site | null {
    return this.others().find((site) => this.atSameSpot(site)) ?? null;
  }

  // The site of the scan spot a frame belongs to (contracts v1.10), when it is open to the frame.
  spotSite(): Site | null {
    return this.#open.find((site) => site.siteId === this.#report.spotSiteId) ?? null;
  }
}
