import { InternalDataError } from "../../domain/errors.js";
import { Report } from "../../domain/Report.js";
import type { MergeOutcome, ReportRecord } from "../../domain/ReportRecord.js";
import type { MergeEvidence } from "../../domain/sites/MergeableReport.js";
import type { ReportMerger } from "../../ports/ReportMerger.js";
import type { NearPlacesFinder } from "../NearPlacesFinder.js";
import type { SiteMerger } from "../sites/SiteMerger.js";

// The merge step: hands the sites task the report's evidence plus the sensitive places near it.
export class SiteReportMerger implements ReportMerger {
  readonly #merger: SiteMerger;
  readonly #places: NearPlacesFinder;

  constructor(merger: SiteMerger, places: NearPlacesFinder) {
    this.#merger = merger;
    this.#places = places;
  }

  async merge(record: ReportRecord): Promise<MergeOutcome> {
    const result = await this.#merger.merge(this.#evidence(record));
    return { siteId: result.siteId, verification: result.reportStatus };
  }

  // Moderation, verification and location always exist here: a rejected report settles before merging.
  #evidence(record: ReportRecord): MergeEvidence {
    const { moderation_result: moderation, verification_result: verification, location } = record;
    if (moderation === undefined || verification === undefined || location === undefined) {
      throw new InternalDataError(`report ${record.report_id} reached merge without moderation, verification or location`);
    }
    const upload = Report.fromRecord(record).upload();
    const near = this.#places.near(upload.gps.lat, upload.gps.lon);
    return { upload, moderation, verification, location, near, brands: record.brand_labels ?? [] };
  }
}
