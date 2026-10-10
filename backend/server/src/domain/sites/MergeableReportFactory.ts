import type { BrandLabel, LocationLookup, ReportUpload } from "../../contracts/index.gen.js";
import { InternalDataError } from "../errors.js";
import { GeoPoint } from "./GeoPoint.js";
import type { MergeableReport, MergeEvidence } from "./MergeableReport.js";
import type { PublicMedia } from "./PublicMedia.js";
import type { SiteBrand, SiteLocation } from "./SiteTypes.js";

const PILOT_DISTRICT_ID = "rajasthan-jodhpur";
const UPLOAD_PREFIX = "upl_";

export class MergeableReportFactory {
  readonly #media: PublicMedia;

  constructor(media: PublicMedia) {
    this.#media = media;
  }

  create(evidence: MergeEvidence): MergeableReport {
    const reportId = MergeableReportFactory.#reportId(evidence);
    MergeableReportFactory.#assertPassed(evidence, reportId);
    const { upload, location } = evidence;
    return {
      ...this.#results(evidence),
      reportId,
      reportType: upload.report_type,
      context: upload.context,
      point: new GeoPoint(upload.gps.lat, upload.gps.lon),
      deviceToken: upload.device_token,
      userId: upload.user_id ?? null,
      reportedAt: upload.captured_at,
      meTooSiteId: upload.me_too_site_id ?? null,
      near: evidence.near,
      bin: evidence.bin,
      brands: evidence.brands.map(MergeableReportFactory.#brand),
      location: MergeableReportFactory.#location(location),
      pilot: location.district.id === PILOT_DISTRICT_ID,
    };
  }

  // What the photo and the models added; all null for a no_bin report without a photo.
  #results({ moderation, verification }: MergeEvidence): Pick<MergeableReport, "embeddingKey" | "photoUrl" | "insights"> {
    const blurredKey = moderation?.blurred_key ?? null;
    return {
      embeddingKey: verification?.embedding_key ?? null,
      photoUrl: blurredKey === null ? null : this.#media.urlFor(blurredKey),
      insights: verification?.insights ?? null,
    };
  }

  static #reportId({ upload, verification }: MergeEvidence): string {
    const reportId = `rpt_${upload.upload_id.slice(UPLOAD_PREFIX.length)}`;
    if (verification !== null && (verification.purpose !== "report" || verification.report_id !== reportId)) {
      throw new InternalDataError(`verification ${verification.report_id} does not belong to ${reportId}`);
    }
    return reportId;
  }

  // The models only gate a photo (decision 20261010-1530); a no_bin report needs no waste check, nor a photo (-1630).
  static #assertPassed({ upload, moderation, verification }: MergeEvidence, reportId: string): void {
    const photoFailed = moderation !== null && moderation.outcome !== "passed";
    const wasteFailed = upload.report_type !== "no_bin" && !MergeableReportFactory.#passedWasteCheck(verification);
    if (photoFailed || wasteFailed || MergeableReportFactory.#photoMissing(upload, moderation === null)) {
      throw new InternalDataError(`${reportId} did not pass the models and is never merged`);
    }
  }

  static #passedWasteCheck(verification: MergeEvidence["verification"]): boolean {
    return verification !== null && verification.decision !== "rejected";
  }

  static #photoMissing(upload: ReportUpload, unmoderated: boolean): boolean {
    return upload.sha256 !== undefined && unmoderated;
  }

  static #brand(label: BrandLabel): SiteBrand {
    const { brand, parent_company, confidence } = label;
    return { brand, parent_company, confidence, source_url: label.mapping_source_url };
  }

  // The location_lookup minus lat, lon and provenance (site.schema.json).
  static #location(lookup: LocationLookup): SiteLocation {
    const { state, district, town, local_body, ward, assembly_seat, loksabha_seat, representatives } = lookup;
    return { state, district, town, local_body, ward, assembly_seat, loksabha_seat, representatives };
  }
}
