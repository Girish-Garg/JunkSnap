import type { FrameOutcome } from "../domain/scout/ScanFindings.js";

// The reports table, only as far as a scan's summary needs it; ids with no row are left out.
export interface FrameOutcomeReader {
  outcomes(reportIds: readonly string[]): Promise<FrameOutcome[]>;
}
