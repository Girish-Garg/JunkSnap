import type { ModerationResult } from "../../contracts/index.gen.js";
import { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";
import type { ReportModerationRequest } from "../../domain/ReportRecord.js";
import type { ReportModerator } from "../../ports/ReportModerator.js";
import type { ModerationService } from "../moderation/ModerationService.js";

// The report pipeline's moderate step, served by the moderation task's service.
export class ServiceReportModerator implements ReportModerator {
  readonly #service: ModerationService;

  constructor(service: ModerationService) {
    this.#service = service;
  }

  moderate(request: ReportModerationRequest): Promise<ModerationResult> {
    return this.#service.moderate(PhotoSubmission.fromReport(request.upload, request.receivedAt));
  }
}
