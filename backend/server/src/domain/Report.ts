import type {
  BrandLabel,
  LocationLookup,
  ModerationResult,
  ReportUpload,
  VerificationResult,
} from "../contracts/index.gen.js";
import { InternalDataError } from "./errors.js";
import { ReportId } from "./ReportId.js";
import { ReportPlacement } from "./ReportPlacement.js";
import type {
  MergeOutcome,
  ReportModerationRequest,
  ReportRecord,
  ReportStatus,
  ReportStatusView,
  StepName,
  Viewer,
} from "./ReportRecord.js";
import type { VerifyClaim } from "./scout/AutoClaim.js";
import type { ClaimPair } from "./scout/DetectableTypes.js";
import { AUTO_CLAIMS } from "./scout/ScanClaim.js";
import type { VerifyFeatures, VerifyRequest } from "./VerifyRequest.js";

const OPEN_STATUSES: ReadonlySet<ReportStatus> = new Set(["queued", "processing"]);
const DECISION_STATUS: Readonly<Record<VerificationResult["decision"], ReportStatus>> = {
  // A passed photo alone never verifies anything (decision 20261010-1530).
  auto_verified: "unverified",
  community_check: "unverified",
  rejected: "rejected",
};
const UPLOAD_FIELDS = [
  "upload_id", "report_type", "context", "capture_mode", "sha256", "gps", "target",
  "device_token", "captured_at", "user_id", "scan", "note", "me_too_site_id", "hints",
] as const;

// One report's lifecycle; every change goes through a method and leaves a new frozen record.
export class Report {
  #record: Readonly<ReportRecord>;

  private constructor(record: ReportRecord) {
    this.#record = Object.freeze(record);
  }

  // user_id comes only from the verified token; any value in the body is replaced. A long-range report keeps its distance.
  static receive(upload: ReportUpload, receivedAt: string, userId?: string): Report {
    const reportId = ReportId.fromUpload(upload.upload_id).value;
    const fresh = { report_id: reportId, user_id: userId, received_at: receivedAt, updated_at: receivedAt };
    const evidence = ReportPlacement.of(upload).evidence();
    return new Report({ ...upload, ...fresh, ...evidence, status: "queued", completed_steps: [] });
  }

  static fromRecord(record: ReportRecord): Report {
    return new Report(record);
  }

  get id(): string {
    return this.#record.report_id;
  }

  get status(): ReportStatus {
    return this.#record.status;
  }

  toRecord(): ReportRecord {
    return this.#record;
  }

  // 0 for an item written before versions existed.
  get version(): number {
    return this.#record.version ?? 0;
  }

  // The repository calls this once its conditional write of version + 1 succeeded.
  advanceVersion(): void {
    this.#set({ version: this.version + 1 });
  }

  // Still queued at or before the cutoff, so its first message is no longer in flight.
  isQueuedSince(cutoff: string): boolean {
    return this.#record.status === "queued" && this.#record.received_at <= cutoff;
  }

  // A user's report belongs to that user; a guest report made before accounts belongs to its device.
  isOwnedBy(viewer: Viewer): boolean {
    const owner = this.#record.user_id;
    return owner === undefined ? viewer.deviceToken === this.#record.device_token : viewer.userId === owner;
  }

  // Decision 20261010-1630: a no_bin report may come without a photo (no sha256).
  hasPhoto(): boolean {
    return this.#record.sha256 !== undefined;
  }

  // A no_bin photo only shows the spot; the models never judge it as waste.
  needsWasteCheck(): boolean {
    return this.#record.report_type !== "no_bin";
  }

  // Rejected, needs_review and both verification outcomes end the pipeline.
  isSettled(): boolean {
    return !OPEN_STATUSES.has(this.#record.status);
  }

  hasCompleted(step: StepName): boolean {
    return this.#record.completed_steps.includes(step);
  }

  // True when this call moved the report out of queued, so the caller saves it at once.
  start(now: string): boolean {
    if (this.#record.status !== "queued") {
      return false;
    }
    this.#set({ status: "processing", updated_at: now });
    return true;
  }

  completeStep(step: StepName, now: string): void {
    const steps = this.hasCompleted(step) ? this.#record.completed_steps : [...this.#record.completed_steps, step];
    this.#set({ completed_steps: steps, updated_at: now });
  }

  recordModeration(moderation: ModerationResult): void {
    const status = moderation.outcome === "rejected" ? "rejected" : this.status;
    this.#set({ moderation_result: moderation, status });
  }

  // A scout frame takes on the type and context the models found; finding nothing rejects it.
  recordVerification(verification: VerificationResult): void {
    const kind = this.#record.auto_claim;
    if (kind !== undefined) {
      AUTO_CLAIMS[kind].assertAnswered(verification);
    }
    const rejected = verification.decision === "rejected";
    const found = rejected ? undefined : this.#found(verification);
    const status = rejected || found === null ? "rejected" : this.status;
    this.#set({ verification_result: verification, status, ...found });
  }

  recordBrands(brands: readonly BrandLabel[]): void {
    this.#set({ brand_labels: brands });
  }

  recordLocation(location: LocationLookup): void {
    this.#set({ location });
  }

  // A merged report's status follows its site's verification.
  recordSite(outcome: MergeOutcome): void {
    this.#set({ site_id: outcome.siteId, status: outcome.verification });
  }

  finish(now: string): void {
    if (this.isSettled()) {
      return;
    }
    const decision = this.#record.verification_result?.decision;
    if (decision === undefined) {
      throw new InternalDataError(`report ${this.id} finished the pipeline without a verification`);
    }
    this.#set({ status: DECISION_STATUS[decision], updated_at: now });
  }

  markNeedsReview(now: string): void {
    this.#set({ status: "needs_review", updated_at: now });
  }

  moderationRequest(): ReportModerationRequest {
    const id = ReportId.parse(this.id);
    const { received_at: receivedAt } = this.#record;
    return { reportId: this.id, originalKey: id.originalKey(), blurredKey: id.blurredKey(), receivedAt, upload: this.upload() };
  }

  verifyRequest(features: Omit<VerifyFeatures, "gps_accuracy_m">): VerifyRequest {
    const all = { gps_accuracy_m: this.#record.gps.accuracy_m, ...features };
    return { report_id: this.id, purpose: "report", blurred_key: this.blurredKey(), ...this.#verifyClaim(), features: all };
  }

  blurredKey(): string {
    return this.#record.moderation_result?.blurred_key ?? ReportId.parse(this.id).blurredKey();
  }

  gps(): ReportUpload["gps"] {
    return this.#record.gps;
  }

  // The reporter's fix and the waste's spot: the long-range target when set (decision 20261011-0400).
  placement(): ReportPlacement {
    return ReportPlacement.of(this.#record);
  }

  upload(): ReportUpload {
    const present = UPLOAD_FIELDS.filter((field) => this.#record[field] !== undefined);
    return Object.fromEntries(present.map((field) => [field, this.#record[field]])) as ReportUpload;
  }

  statusView(publicBaseUrl: string): ReportStatusView {
    const record = this.#record;
    return {
      report_id: record.report_id,
      status: record.status,
      site_id: record.site_id ?? null,
      blurred_url: this.#blurredUrl(publicBaseUrl),
      report: this.upload(),
      moderation: record.moderation_result ?? null,
      verification: record.verification_result ?? null,
      received_at: record.received_at,
      updated_at: record.updated_at,
    };
  }

  #blurredUrl(publicBaseUrl: string): string | null {
    const moderation = this.#record.moderation_result;
    if (moderation?.outcome !== "passed" || moderation.blurred_key === null) {
      return null;
    }
    return `${publicBaseUrl}/${moderation.blurred_key}`;
  }

  #verifyClaim(): VerifyClaim {
    const { report_type, context, auto_claim: kind } = this.#record;
    return kind === undefined ? { report_type, context } : AUTO_CLAIMS[kind].verifyClaim({ report_type, context });
  }

  // Undefined when the person picked the whole claim.
  #found(verification: VerificationResult): ClaimPair | null | undefined {
    const kind = this.#record.auto_claim;
    return kind === undefined ? undefined : AUTO_CLAIMS[kind].found(this.#record, verification);
  }

  #set(changes: Partial<ReportRecord>): void {
    this.#record = Object.freeze({ ...this.#record, ...changes });
  }
}
