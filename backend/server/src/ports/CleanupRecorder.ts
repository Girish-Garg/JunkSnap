import type { ModerationResult, VerificationResult } from "../contracts/index.gen.js";
import type { CleanupJob, SiteKind } from "../domain/CleanupJob.js";

export interface CleanupVerdict {
  readonly moderation: ModerationResult;
  readonly verification: VerificationResult | null;
}

// Sites task: owns the cleanups table and the site's cleanup state.
export interface CleanupRecorder {
  siteKind(siteId: string): Promise<SiteKind>;
  // Accepts only when moderation passed and is_clean; a no-op unless the cleanup is still checking.
  settle(job: CleanupJob, verdict: CleanupVerdict): Promise<void>;
  // The last receive failed: the cleanup becomes rejected before the message moves to the dead-letter queue.
  giveUp(job: CleanupJob): Promise<void>;
}
