import { InternalDataError } from "../../domain/errors.js";
import { Report } from "../../domain/Report.js";
import type { MergeOutcome, ReportRecord } from "../../domain/ReportRecord.js";
import type { MergeEvidence } from "../../domain/sites/MergeableReport.js";
import type { ReportMerger } from "../../ports/ReportMerger.js";
import { GeoPoint } from "../../domain/sites/GeoPoint.js";
import type { BinLocator } from "../BinLocator.js";
import type { NearPlacesFinder } from "../NearPlacesFinder.js";
import type { SiteMerger } from "../sites/SiteMerger.js";

// The merge step: hands the sites task the report's evidence plus the sensitive places and nearest bin.
export class SiteReportMerger implements ReportMerger {
  readonly #merger: SiteMerger;
  readonly #places: NearPlacesFinder;
  readonly #bins: BinLocator;

  constructor(merger: SiteMerger, places: NearPlacesFinder, bins: BinLocator) {
    this.#merger = merger;
    this.#places = places;
    this.#bins = bins;
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
    const bin = this.#bins.measure(new GeoPoint(upload.gps.lat, upload.gps.lon), location.town);
    return { upload, moderation, verification, location, near, bin, brands: record.brand_labels ?? [] };
  }
}
