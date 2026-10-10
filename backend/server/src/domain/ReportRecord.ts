import type {
  BrandLabel,
  LocationLookup,
  ModerationResult,
  ReportUpload,
  VerificationResult,
} from "../contracts/index.gen.js";
import type { AutoClaimKind } from "./scout/AutoClaim.js";

// withdrawn: the reporter took the report back from an unverified site (decision 20261010-1700).
export type ReportStatus = "queued" | "processing" | "unverified" | "verified" | "rejected" | "needs_review" | "withdrawn";
// A merged report follows its site (decision 20261010-1530).
export type SiteVerification = "unverified" | "verified" | "rejected";
export type StepName = "moderate" | "verify" | "brands" | "locate" | "merge";

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
