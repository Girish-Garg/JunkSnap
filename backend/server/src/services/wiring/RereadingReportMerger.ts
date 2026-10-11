import type { MergeOutcome, ReportRecord } from "../../domain/ReportRecord.js";
import type { ReportMerger } from "../../ports/ReportMerger.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";

// followSite skips a report the worker still holds as processing, so a vote that settles the site after the merge
// wrote it would leave this report behind; re-reading the site last, just before the worker saves the report, catches it.
export class RereadingReportMerger implements ReportMerger {
  readonly #inner: ReportMerger;
  readonly #sites: Pick<SiteRepository, "get">;

  constructor(inner: ReportMerger, sites: Pick<SiteRepository, "get">) {
    this.#inner = inner;
    this.#sites = sites;
  }

  async merge(record: ReportRecord): Promise<MergeOutcome> {
    const outcome = await this.#inner.merge(record);
    const site = await this.#sites.get(outcome.siteId);
    return site === null ? outcome : { siteId: outcome.siteId, verification: site.verification };
  }
}
