import type {
  BrandLabel,
  LocationLookup,
  ModerationResult,
  ReportUpload,
  VerificationResult,
} from "../../contracts/index.gen.js";
import type { BinMeasure } from "../bins/KnownBin.js";
import type { GeoPoint } from "./GeoPoint.js";
import type { NearPlace, ReportContext, ReportInsights, ReportType, SiteBrand, SiteLocation } from "./SiteTypes.js";

// What the worker holds for one report after moderation, verification, location (with nearby places) and brands.
export interface MergeEvidence {
  readonly upload: ReportUpload;
  readonly moderation: ModerationResult;
  readonly verification: VerificationResult;
  readonly location: LocationLookup;
  readonly near: readonly NearPlace[];
  readonly bin: BinMeasure;
  readonly brands: readonly BrandLabel[];
}

export interface MergeableReport {
  readonly reportId: string;
  readonly reportType: ReportType;
  readonly context: ReportContext;
  readonly point: GeoPoint;
  readonly deviceToken: string;
  readonly userId: string | null;
  readonly reportedAt: string;
  readonly embeddingKey: string | null;
  readonly meTooSiteId: string | null;
  readonly photoUrl: string | null;
  readonly insights: ReportInsights | null;
  readonly near: readonly NearPlace[];
  readonly bin: BinMeasure;
  readonly brands: readonly SiteBrand[];
  readonly location: SiteLocation;
  readonly pilot: boolean;
}
