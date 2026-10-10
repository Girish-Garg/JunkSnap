// Mirrors contracts/schemas/report_upload.schema.json and the presign bodies in contracts/README.md.
import type { ReportType } from './ReportType';
import type { SiteContext } from './Site';

export interface GpsFix {
  readonly lat: number;
  readonly lon: number;
  /** Reported accuracy radius in metres. */
  readonly accuracy_m: number;
}

/** What the reporter chose for one photo; the queue adds upload_id and device_token. */
export interface ReportDraft {
  readonly report_type: ReportType;
  readonly context: SiteContext;
  readonly sha256: string;
  readonly gps: GpsFix;
  readonly captured_at: string;
  readonly note?: string;
}

/** Body of POST /reports from the phone. user_id comes from the token, never the body. */
export interface ReportUpload extends ReportDraft {
  readonly upload_id: string;
  readonly capture_mode: 'snap';
  readonly device_token: string;
}

export interface PresignRequest {
  readonly purpose: 'report' | 'cleanup';
  readonly content_type: 'image/jpeg';
  readonly sha256: string;
  readonly device_token: string;
}

export interface PresignResponse {
  readonly upload_id: string;
  readonly upload_url: string;
  /** Sent exactly as given with the PUT; S3 rejects bytes that do not match the hash. */
  readonly headers: Readonly<Record<string, string>>;
  readonly expires_at: string;
}

export interface AcceptedReport {
  readonly report_id: string;
  readonly status: 'queued';
}

export const NOTE_MAX_LENGTH = 280;
