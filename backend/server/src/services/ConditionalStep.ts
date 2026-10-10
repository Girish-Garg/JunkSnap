import type { Report } from "../domain/Report.js";
import type { StepName } from "../domain/ReportRecord.js";
import type { PipelineStep } from "../ports/PipelineStep.js";

export type StepFilter = (report: Report) => boolean;

// Runs the inner step only for the reports it applies to; the pipeline still marks the step done for the rest.
export class ConditionalStep implements PipelineStep {
  readonly #inner: PipelineStep;
  readonly #applies: StepFilter;

  constructor(inner: PipelineStep, applies: StepFilter) {
    this.#inner = inner;
    this.#applies = applies;
  }

  get name(): StepName {
    return this.#inner.name;
  }

  async run(report: Report): Promise<void> {
    if (this.#applies(report)) {
      await this.#inner.run(report);
    }
  }
}
