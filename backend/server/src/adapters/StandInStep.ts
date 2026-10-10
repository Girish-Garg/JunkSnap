import type { StepName } from "../domain/ReportRecord.js";
import type { PipelineStep } from "../ports/PipelineStep.js";

// Placeholder for a step another task builds: it records nothing, so the report's field stays null.
export class StandInStep implements PipelineStep {
  readonly name: StepName;

  constructor(name: StepName) {
    this.name = name;
  }

  async run(): Promise<void> {}
}
