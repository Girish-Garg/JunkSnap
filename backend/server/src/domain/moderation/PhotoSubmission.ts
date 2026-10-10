import type { ReportUpload } from "../../contracts/index.gen.js";
import { GeoPoint } from "./GeoPoint.js";
import { PhotoId } from "./PhotoId.js";

export type CaptureMode = ReportUpload["capture_mode"];

export interface Sender {
  readonly kind: "device" | "user";
  readonly id: string;
}

// The fields of the SQS cleanup message that moderation reads (contracts/README.md).
export interface CleanupPhoto {
  readonly site_id: string;
  readonly upload_id: string;
  readonly device_token: string;
  readonly user_id?: string;
  readonly sha256: string;
  readonly gps: { readonly lat: number; readonly lon: number };
  readonly captured_at: string;
  readonly received_at: string;
}

// The site a cleanup after-photo claims to clear.
export interface CleanupSite {
  readonly id: string;
  readonly point: GeoPoint;
}

export interface SubmissionFields {
  readonly photoId: PhotoId;
  readonly sha256: string;
  readonly location: GeoPoint;
  readonly deviceToken: string;
  // Null only for a guest report made before accounts.
  readonly userId: string | null;
  readonly captureMode: CaptureMode;
  readonly capturedAt: Date;
  readonly receivedAt: Date;
  readonly note: string | null;
  readonly site: CleanupSite | null;
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
      userId: upload.user_id ?? null,
      captureMode: upload.capture_mode,
      capturedAt: new Date(upload.captured_at),
      receivedAt: new Date(receivedAt),
      note: upload.note ?? null,
      site: null,
    });
  }

  static fromCleanup(cleanup: CleanupPhoto, sitePoint: GeoPoint): PhotoSubmission {
    return new PhotoSubmission({
      photoId: PhotoId.fromUpload("cleanup", cleanup.upload_id),
      sha256: cleanup.sha256,
      location: new GeoPoint(cleanup.gps.lat, cleanup.gps.lon),
      deviceToken: cleanup.device_token,
      userId: cleanup.user_id ?? null,
      captureMode: "snap",
      capturedAt: new Date(cleanup.captured_at),
      receivedAt: new Date(cleanup.received_at),
      note: null,
      site: { id: cleanup.site_id, point: sitePoint },
    });
  }

  get photoId(): PhotoId {
    return this.fields.photoId;
  }

  // The device, then the account when signed in; limits and blocks apply to each.
  senders(): Sender[] {
    const { deviceToken, userId } = this.fields;
    const device: Sender = { kind: "device", id: deviceToken };
    return userId === null ? [device] : [device, { kind: "user", id: userId }];
  }
}
