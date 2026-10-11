import { UNMEASURED } from "../../src/domain/bins/KnownBin.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { Report } from "../../src/domain/Report.js";
import type { ReportRecord } from "../../src/domain/ReportRecord.js";
import type { MergeableReport } from "../../src/domain/sites/MergeableReport.js";
import type { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";

// A stored report row as the worker's merge step hands it to the sites task (SiteReportMerger). Nearby places and the
// bin reading only shape a site that is being founded, so a merge into the kept site leaves both out; the kept site
// keeps its own. A Me too aimed at the absorbed site counts for the kept one, which is the same dump.
export class StoredReportEvidence {
  readonly #factory: MergeableReportFactory;

  constructor(factory: MergeableReportFactory) {
    this.#factory = factory;
  }

  mergeable(record: ReportRecord, absorbedId: string, keptId: string): MergeableReport {
    if (record.location === undefined) {
      throw new InternalDataError(`report ${record.report_id} has no location`);
    }
    const report = Report.fromRecord(record);
    const mergeable = this.#factory.create({
      upload: report.upload(),
      moderation: record.moderation_result ?? null,
      verification: record.verification_result ?? null,
      location: record.location,
      near: [],
      bin: UNMEASURED,
      brands: record.brand_labels ?? [],
      reporterConfirmed: report.isConfirmedByReporter(),
    });
    return mergeable.meTooSiteId === absorbedId ? { ...mergeable, meTooSiteId: keptId } : mergeable;
  }
}
