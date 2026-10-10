import type { MergeOutcome, ReportRecord } from "../../domain/ReportRecord.js";
import type { CrawlActivator } from "../../ports/CrawlActivator.js";
import type { Logger } from "../../ports/Logger.js";
import type { ReportMerger } from "../../ports/ReportMerger.js";

// The pipeline stops once a report settles, so a verified report queues its district's ward crawl inside the merge.
export class ActivatingReportMerger implements ReportMerger {
  readonly #inner: ReportMerger;
  readonly #activator: CrawlActivator;
  readonly #logger: Logger;

  constructor(inner: ReportMerger, activator: CrawlActivator, logger: Logger) {
    this.#inner = inner;
    this.#activator = activator;
    this.#logger = logger;
  }

  async merge(record: ReportRecord): Promise<MergeOutcome> {
    const outcome = await this.#inner.merge(record);
    if (outcome.verification === "verified") {
      await this.#activate(record);
    }
    return outcome;
  }

  // A failed activation never holds the report back; the district's next verified report tries again.
  async #activate(record: ReportRecord): Promise<void> {
    const district = record.location?.district;
    if (district === undefined) {
      return;
    }
    try {
      await this.#activator.activate({ id: district.id, name: district.name }, record.report_id);
    } catch (error) {
      const fields = { district_id: district.id, report_id: record.report_id, error };
      this.#logger.warn(fields, "crawl activation failed; the report still settles");
    }
  }
}
