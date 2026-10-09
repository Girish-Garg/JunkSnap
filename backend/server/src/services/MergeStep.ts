import type { Report } from "../domain/Report.js";
import type { PipelineStep } from "../ports/PipelineStep.js";
import type { ReportMerger } from "../ports/ReportMerger.js";

export class MergeStep implements PipelineStep {
  readonly name = "merge";
  readonly #merger: ReportMerger;

  constructor(merger: ReportMerger) {
    this.#merger = merger;
  }

  async run(report: Report): Promise<void> {
    report.recordSite(await this.#merger.merge(report.toRecord()));
  }
}
