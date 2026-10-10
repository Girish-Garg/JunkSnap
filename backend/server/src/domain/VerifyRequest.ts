import type { VerifyClaim } from "./scout/AutoClaim.js";

export interface VerifyFeatures {
  readonly gps_accuracy_m: number;
  readonly reputation: number;
  readonly nearby_verified_reports: number;
}

// Worker to ML POST /internal/verify body; it names only the blurred copy, never the original.
export interface VerifyRequest {
  readonly report_id: string;
  readonly purpose: "report" | "cleanup";
  readonly blurred_key: string;
  readonly report_type: VerifyClaim["report_type"];
  readonly context: VerifyClaim["context"];
  readonly features: VerifyFeatures;
}
