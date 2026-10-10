import type { ConfirmRequest } from '../domain/ReportConfirmation';
import type { ReportListPage } from '../domain/ReportList';
import type { ReportStatusView } from '../domain/ReportStatus';
import type { AcceptedReport, NoBinUpload, PresignRequest, PresignResponse, ReportUpload } from '../domain/ReportUpload';

/** The Snap routes in contracts/README.md. Failures reject with ApiError. */
export interface ReportApi {
  presign(request: PresignRequest): Promise<PresignResponse>;
  /** PUT to the presigned URL with exactly its headers. */
  putPhoto(upload: PresignResponse, photo: ArrayBuffer): Promise<void>;
  /** Idempotent per upload_id: a retry returns the same report id. */
  submit(upload: ReportUpload | NoBinUpload): Promise<AcceptedReport>;
  status(reportId: string): Promise<ReportStatusView>;
  /** The reporter's answer to a needs_confirmation report; returns the report status (contracts v1.16). */
  confirm(reportId: string, request: ConfirmRequest): Promise<ReportStatusView>;
  /** GET /me/reports: the signed-in user's own reports, newest first; cursor is the next_cursor before. */
  mine(cursor: string | null): Promise<ReportListPage>;
}

/** Who is asking: the Cognito ID token when signed in, and this phone's device token. */
export interface RequestIdentity {
  /** forceRefresh asks Cognito for a new token even if the cached one looks valid. */
  idToken(forceRefresh?: boolean): Promise<string | null>;
  deviceToken(): Promise<string>;
}
