import type {
  BrandLabel,
  LocationLookup,
  ModerationResult,
  ReportUpload,
  VerificationResult,
} from "../contracts/index.gen.js";

export type ReportStatus = "queued" | "processing" | "verified" | "community_check" | "rejected" | "needs_review";
export type SiteVerification = "verified" | "community_check";
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
