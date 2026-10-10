import type { Report } from "../domain/Report.js";
import type { PipelineStep } from "../ports/PipelineStep.js";
import type { ReportLocator } from "../ports/ReportLocator.js";

export class LocateStep implements PipelineStep {
  readonly name = "locate";
  readonly #locator: ReportLocator;

  constructor(locator: ReportLocator) {
    this.#locator = locator;
  }

  async run(report: Report): Promise<void> {
    report.recordLocation(await this.#locator.locate(report.gps()));
  }
}
