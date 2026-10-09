import type { ReportStatusView } from '../domain/ReportStatus';
import type { AcceptedReport, PresignRequest, PresignResponse, ReportUpload } from '../domain/ReportUpload';

/** The Snap routes in contracts/README.md. Failures reject with ApiError. */
export interface ReportApi {
  presign(request: PresignRequest): Promise<PresignResponse>;
  /** PUT to the presigned URL with exactly its headers. */
  putPhoto(upload: PresignResponse, photo: ArrayBuffer): Promise<void>;
  /** Idempotent per upload_id: a retry returns the same report id. */
  submit(upload: ReportUpload): Promise<AcceptedReport>;
  status(reportId: string): Promise<ReportStatusView>;
}

/** Who is asking: the Cognito ID token when signed in, and this phone's device token. */
export interface RequestIdentity {
  idToken(): Promise<string | null>;
  deviceToken(): Promise<string>;
}
