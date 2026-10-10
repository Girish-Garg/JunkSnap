import type {
  BrandLabel,
  LocationLookup,
  ModerationResult,
  ReportUpload,
  VerificationResult,
} from "../contracts/index.gen.js";
import type { AutoClaimKind } from "./scout/AutoClaim.js";

// withdrawn: the reporter took the report back (decision 20261010-1700). needs_confirmation waits for the reporter's
// answer; not_confirmed: no answer in time (contracts v1.16).
export type ReportStatus =
  | "queued"
  | "processing"
  | "unverified"
  | "verified"
  | "rejected"
  | "needs_review"
  | "withdrawn"
  | "needs_confirmation"
  | "not_confirmed";
// A merged report follows its site (decision 20261010-1530).
export type SiteVerification = "unverified" | "verified" | "rejected";
export type StepName = "moderate" | "verify" | "brands" | "locate" | "merge";
export type ConfirmationAnswer = "sure" | "withdrawn" | "expired";

// The reporter's check when the judge was unsure (contracts v1.16): the table field and GET /reports/{id} share it.
export interface ConfirmationRecord {
  readonly question: string;
  readonly reasoning: string;
  readonly report_type: ReportUpload["report_type"];
  readonly asked_at: string;
  readonly expires_at: string;
  readonly answer: ConfirmationAnswer | null;
  // When the window closed for expired.
  readonly answered_at: string | null;
}

// The reports table item: upload fields and received_at stay top-level and absent fields are omitted, because GSIs key on them.
export interface ReportRecord extends ReportUpload {
  readonly report_id: string;
  readonly received_at: string;
  readonly updated_at: string;
  readonly status: ReportStatus;
  readonly completed_steps: readonly StepName[];
  readonly moderation_result?: ModerationResult;
  readonly verification_result?: VerificationResult;
  readonly brand_labels?: readonly BrandLabel[];
  readonly location?: LocationLookup;
  readonly site_id?: string;
  readonly withdrawn_at?: string;
  // Only on a report the verify step asked its reporter about.
  readonly confirmation?: ConfirmationRecord;
  // Scan frames only: the part of the claim the models name (contracts v1.10); absent when the person picked both.
  readonly auto_claim?: AutoClaimKind;
  // Scan frames only: t_ms of the first frame of the frame's spot (ScanSpots).
  readonly scan_spot?: number;
  // Metres from gps to target, only on a long-range report (decision 20261011-0400-hem-long-range-target).
  readonly target_distance_m?: number;
  // Optimistic lock: every save writes version + 1 only if the stored version is still the one read.
  readonly version?: number;
}

// Body of GET /reports/{id}.
export interface ReportStatusView {
  readonly report_id: string;
  readonly status: ReportStatus;
  readonly site_id: string | null;
  readonly blurred_url: string | null;
  readonly report: ReportUpload;
  readonly moderation: ModerationResult | null;
  readonly verification: VerificationResult | null;
  readonly confirmation: ConfirmationRecord | null;
  readonly received_at: string;
  readonly updated_at: string;
}

export interface ReportModerationRequest {
  readonly reportId: string;
  readonly originalKey: string;
  readonly blurredKey: string;
  readonly receivedAt: string;
  readonly upload: ReportUpload;
}

// Who sends or asks: userId is the verified token's sub, absent for a guest.
export interface Reporter {
  readonly deviceToken: string;
  readonly userId?: string;
}

export interface Viewer {
  readonly deviceToken?: string;
  readonly userId?: string;
}

export interface MergeOutcome {
  readonly siteId: string;
  readonly verification: SiteVerification;
}
