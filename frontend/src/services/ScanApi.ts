import type { AcceptedScan, ScanPresignRequest, ScanPresignResponse, ScanSession, ScanStatusView } from '../domain/ScanUpload';

/** The Scan routes in contracts/README.md; every one needs sign-in. Failures reject with ApiError. */
export interface ScanApi {
  /** 400 scan_too_large over 60 s or 40 MB. */
  presign(request: ScanPresignRequest): Promise<ScanPresignResponse>;
  putVideo(upload: ScanPresignResponse, video: ArrayBuffer): Promise<void>;
  /** Idempotent per scan_id. */
  submit(session: ScanSession): Promise<AcceptedScan>;
  status(scanId: string): Promise<ScanStatusView>;
}
