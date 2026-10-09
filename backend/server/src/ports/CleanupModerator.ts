import type { ModerationResult } from "../contracts/index.gen.js";
import type { CleanupJob } from "../domain/CleanupJob.js";

// Moderation task: like reports, plus the near_site check; writes the blurred copy to job.blurredKey().
export interface CleanupModerator {
  moderate(job: CleanupJob): Promise<ModerationResult>;
}
