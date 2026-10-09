import type { Report } from "../domain/Report.js";
import type { PipelineStep } from "../ports/PipelineStep.js";
import type { ReportModerator } from "../ports/ReportModerator.js";

export class ModerateStep implements PipelineStep {
  readonly name = "moderate";
  readonly #moderator: ReportModerator;

  constructor(moderator: ReportModerator) {
    this.#moderator = moderator;
  }

  async run(report: Report): Promise<void> {
    report.recordModeration(await this.#moderator.moderate(report.moderationRequest()));
  }
}
