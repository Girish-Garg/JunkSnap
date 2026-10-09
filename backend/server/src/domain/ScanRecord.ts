import type { ScanSession } from "../contracts/scanSessionPending.js";

export type ScanStatus = "queued" | "processing" | "done" | "failed";
export type ScanFailureReason = "invalid_video" | "retries_exhausted";

export interface ScanFrameCounts {
  readonly sampled: number;
  readonly kept: number;
  readonly dropped_no_fix: number;
}

// One row of the scans table: the posted session plus its processing state.
export interface ScanRecord extends ScanSession {
  readonly received_at: string;
  readonly status: ScanStatus;
  readonly reason: ScanFailureReason | null;
  readonly frames: ScanFrameCounts | null;
  readonly report_ids: readonly string[];
  readonly updated_at: string;
}

export interface ScanUpdate {
  readonly status: ScanStatus;
  readonly reason: ScanFailureReason | null;
  readonly updated_at: string;
  readonly frames?: ScanFrameCounts;
  readonly report_ids?: readonly string[];
}
