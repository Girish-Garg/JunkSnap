import type { Report } from "../domain/Report.js";
import type { StepName } from "../domain/ReportRecord.js";

// One report pipeline step; it tells the report its result and the pipeline saves it.
export interface PipelineStep {
  readonly name: StepName;
  run(report: Report): Promise<void>;
}
