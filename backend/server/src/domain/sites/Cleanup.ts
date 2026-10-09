import type { ModerationResult, VerificationResult } from "../../contracts/index.gen.js";

export type CleanupStatus = "checking" | "accepted" | "rejected";

// Inline body of POST /sites/{id}/cleanup (contracts/README.md).
export interface CleanupRequest {
  readonly upload_id: string;
  readonly device_token: string;
  readonly sha256: string;
  readonly gps: { readonly lat: number; readonly lon: number; readonly accuracy_m: number };
  readonly captured_at: string;
}

// One row of the cleanups table, before the worker's results.
export interface CleanupRecord extends CleanupRequest {
  readonly cleanup_id: string;
  readonly site_id: string;
  readonly received_at: string;
  readonly status: CleanupStatus;
}

// The 202 body; the phone then polls site.cleanup_status.
export interface CleanupAccepted {
  readonly cleanup_id: string;
  readonly site_id: string;
  readonly status: CleanupStatus;
}

// The worker's results for one after-photo; null when retries ran out before that step finished.
export interface CleanupOutcome {
  readonly moderation: ModerationResult | null;
  readonly verification: VerificationResult | null;
}

export interface CleanupFinish extends CleanupOutcome {
  readonly status: Exclude<CleanupStatus, "checking">;
}
