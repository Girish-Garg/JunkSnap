import type { LocationLookup, ReportUpload } from "../contracts/index.gen.js";

// Location task: state, district, local body, ward and seats for a point.
export interface ReportLocator {
  locate(gps: ReportUpload["gps"]): Promise<LocationLookup>;
}
