import type {
  BrandLabel,
  LocationLookup,
  ModerationResult,
  ReportUpload,
  VerificationResult,
} from "../../contracts/index.gen.js";
import type { GeoPoint } from "./GeoPoint.js";
import type { ReportContext, ReportType, SiteBrand, SiteLocation } from "./SiteTypes.js";

// What the worker holds for one report after moderation, verification, location and brands.
export interface MergeEvidence {
  readonly upload: ReportUpload;
  readonly moderation: ModerationResult;
  readonly verification: VerificationResult;
  readonly location: LocationLookup;
  readonly brands: readonly BrandLabel[];
}

export interface MergeableReport {
  readonly reportId: string;
  readonly reportType: ReportType;
  readonly context: ReportContext;
  readonly point: GeoPoint;
  readonly deviceToken: string;
  readonly reportedAt: string;
  readonly autoVerified: boolean;
  readonly embeddingKey: string | null;
  readonly meTooSiteId: string | null;
  readonly photoUrl: string | null;
  readonly burning: boolean;
  readonly brands: readonly SiteBrand[];
  readonly location: SiteLocation;
  readonly pilot: boolean;
}
