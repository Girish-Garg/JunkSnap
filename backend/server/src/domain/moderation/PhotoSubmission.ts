import type { ReportUpload } from "../../contracts/index.gen.js";
import { GeoPoint } from "./GeoPoint.js";
import { PhotoId } from "./PhotoId.js";

export type CaptureMode = ReportUpload["capture_mode"];

// The fields of the SQS cleanup message that moderation reads (contracts/README.md).
export interface CleanupPhoto {
  readonly upload_id: string;
  readonly device_token: string;
  readonly sha256: string;
  readonly gps: { readonly lat: number; readonly lon: number };
  readonly captured_at: string;
  readonly received_at: string;
}

export interface SubmissionFields {
  readonly photoId: PhotoId;
  readonly sha256: string;
  readonly location: GeoPoint;
  readonly deviceToken: string;
  readonly captureMode: CaptureMode;
  readonly capturedAt: Date;
  readonly receivedAt: Date;
  readonly note: string | null;
  readonly site: GeoPoint | null;
}

// One photo to moderate: a report photo, or a cleanup after-photo with its site's position.
export class PhotoSubmission {
  readonly fields: SubmissionFields;

  constructor(fields: SubmissionFields) {
    this.fields = fields;
  }

  static fromReport(upload: ReportUpload, receivedAt: string): PhotoSubmission {
    return new PhotoSubmission({
      photoId: PhotoId.fromUpload("report", upload.upload_id),
      sha256: upload.sha256,
      location: new GeoPoint(upload.gps.lat, upload.gps.lon),
      deviceToken: upload.device_token,
      captureMode: upload.capture_mode,
      capturedAt: new Date(upload.captured_at),
      receivedAt: new Date(receivedAt),
      note: upload.note ?? null,
      site: null,
    });
  }

  static fromCleanup(cleanup: CleanupPhoto, site: GeoPoint): PhotoSubmission {
    return new PhotoSubmission({
      photoId: PhotoId.fromUpload("cleanup", cleanup.upload_id),
      sha256: cleanup.sha256,
      location: new GeoPoint(cleanup.gps.lat, cleanup.gps.lon),
      deviceToken: cleanup.device_token,
      captureMode: "snap",
      capturedAt: new Date(cleanup.captured_at),
      receivedAt: new Date(cleanup.received_at),
      note: null,
      site,
    });
  }

  get photoId(): PhotoId {
    return this.fields.photoId;
  }
}
