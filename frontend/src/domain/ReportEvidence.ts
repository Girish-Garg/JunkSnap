// The parts of moderation_result, verification_result and report_upload that GET /reports/{id}
// returns and the "What we checked" view reads (contracts/schemas). Fields beyond the ones the
// status line has always read are optional, so older statuses and mock views stay valid.

export type CheckResult = 'pass' | 'fail' | 'skipped';

export interface ModerationCheck {
  readonly result: CheckResult;
}

export type ModerationCheckName = 'inside_india' | 'fresh_timestamp' | 'duplicate' | 'rate_limit' | 'device_token';

export type ModerationReason =
  | 'invalid_image'
  | 'unsafe_image'
  | 'person_dumping'
  | 'outside_india'
  | 'stale_timestamp'
  | 'duplicate'
  | 'rate_limited'
  | 'blocked_device'
  | 'not_near_site';

export interface ModerationEvidence {
  readonly outcome: 'passed' | 'rejected';
  readonly reasons?: readonly ModerationReason[];
  /** Null when the photo was stopped before blurring. */
  readonly blur?: { readonly faces: number; readonly plates: number } | null;
  readonly checks?: Readonly<Partial<Record<ModerationCheckName, ModerationCheck>>>;
}

export type SignalName = 'rekognition_labels' | 'yolo' | 'embedding_classifier' | 'vision_judge';

/** One model that ran: score is its support for the claim, 0 to 1. */
export interface SignalEvidence {
  readonly name: SignalName;
  readonly score: number;
  readonly provider: string;
  readonly model: string;
  readonly version: string;
}

export interface JudgeEvidence {
  readonly report_type: string;
  /** Short reason from the vision judge on the blurred photo; only the reporter ever sees it. */
  readonly rationale?: string;
}

export interface VerificationEvidence {
  /** needs_confirmation: the judge was unsure, so the reporter is asked (contracts v1.16). */
  readonly decision: 'auto_verified' | 'community_check' | 'rejected' | 'needs_confirmation';
  readonly judge: JudgeEvidence | null;
  readonly signals?: readonly SignalEvidence[];
  readonly features?: { readonly gps_accuracy_m: number };
  /** version ends with `+<veto reason> by <models>` when a veto rejected the photo (decision 20261011-0230). */
  readonly combiner?: { readonly version: string };
}

/** report_upload as the api echoes it back. */
export interface UploadEvidence {
  readonly report_type: string;
  readonly capture_mode?: 'snap' | 'scan';
  readonly gps?: { readonly accuracy_m: number; readonly lat?: number; readonly lon?: number };
  /** What GET /me/reports needs to rebuild an Activity row on a phone that never held the report. */
  readonly context?: string;
  readonly captured_at?: string;
  /** The photo's SHA-256, which is also its Activity row id; a no-bin report without a photo has none. */
  readonly sha256?: string;
}
