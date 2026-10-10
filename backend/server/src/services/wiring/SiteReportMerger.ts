import { InternalDataError } from "../../domain/errors.js";
import { Report } from "../../domain/Report.js";
import type { MergeOutcome, ReportRecord } from "../../domain/ReportRecord.js";
import type { MergeEvidence } from "../../domain/sites/MergeableReport.js";
import type { ReportMerger } from "../../ports/ReportMerger.js";
import { ReportPlacement } from "../../domain/ReportPlacement.js";
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

  // A rejected report settles before merging; a no_bin report may lack moderation (no photo) and verification.
  #evidence(record: ReportRecord): MergeEvidence {
    const { moderation_result, verification_result, location } = record;
    if (location === undefined) {
      throw new InternalDataError(`report ${record.report_id} reached merge without a location`);
    }
    const moderation = moderation_result ?? null;
    const verification = verification_result ?? null;
    const report = Report.fromRecord(record);
    const upload = report.upload();
    const { spot: site } = ReportPlacement.of(upload);
    const near = this.#places.near(site.lat, site.lon);
    const bin = this.#bins.measure(site, location.town);
    const spot = record.scan_spot === undefined ? {} : { scanSpot: record.scan_spot };
    const brands = record.brand_labels ?? [];
    const reporterConfirmed = report.isConfirmedByReporter();
    return { upload, moderation, verification, location, near, bin, brands, reporterConfirmed, ...spot };
  }
}
