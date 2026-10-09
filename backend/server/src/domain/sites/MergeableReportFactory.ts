import type { BrandLabel, LocationLookup, ReportUpload, VerificationResult } from "../../contracts/index.gen.js";
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
    const { upload, moderation, verification, location } = evidence;
    const blurredKey = moderation.blurred_key;
    return {
      reportId: MergeableReportFactory.#reportId(upload, verification),
      reportType: upload.report_type,
      context: upload.context,
      point: new GeoPoint(upload.gps.lat, upload.gps.lon),
      deviceToken: upload.device_token,
      reportedAt: upload.captured_at,
      autoVerified: MergeableReportFactory.#autoVerified(verification),
      embeddingKey: verification.embedding_key,
      meTooSiteId: upload.me_too_site_id ?? null,
      photoUrl: blurredKey === null ? null : this.#media.urlFor(blurredKey),
      burning: verification.judge?.burning ?? false,
      brands: evidence.brands.map(MergeableReportFactory.#brand),
      location: MergeableReportFactory.#location(location),
      pilot: location.district.id === PILOT_DISTRICT_ID,
    };
  }

  static #reportId(upload: ReportUpload, verification: VerificationResult): string {
    const reportId = `rpt_${upload.upload_id.slice(UPLOAD_PREFIX.length)}`;
    if (verification.purpose !== "report" || verification.report_id !== reportId) {
      throw new InternalDataError(`verification ${verification.report_id} does not belong to ${reportId}`);
    }
    return reportId;
  }

  static #autoVerified(verification: VerificationResult): boolean {
    if (verification.decision === "rejected") {
      throw new InternalDataError(`${verification.report_id} was rejected and is never merged`);
    }
    return verification.decision === "auto_verified";
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
