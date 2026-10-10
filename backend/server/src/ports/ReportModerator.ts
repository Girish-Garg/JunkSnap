import type { ModerationResult } from "../contracts/index.gen.js";
import type { ReportModerationRequest } from "../domain/ReportRecord.js";

// Moderation task: checks the original, writes the blurred copy to request.blurredKey, returns the result.
export interface ReportModerator {
  moderate(request: ReportModerationRequest): Promise<ModerationResult>;
}
