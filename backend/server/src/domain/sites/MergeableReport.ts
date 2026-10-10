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
  // Null for a no_bin report without a photo; verification is also null for any no_bin report (decision 20261010-1630).
  readonly moderation: ModerationResult | null;
  readonly verification: VerificationResult | null;
  readonly location: LocationLookup;
  readonly near: readonly NearPlace[];
  readonly bin: BinMeasure;
  readonly brands: readonly BrandLabel[];
  // Scan frames only: t_ms of the first frame of the frame's spot (contracts v1.10).
  readonly scanSpot?: number;
  // The reporter answered sure after the judge was unsure (contracts v1.16); only then does needs_confirmation pass.
  readonly reporterConfirmed?: boolean;
}

export interface MergeableReport {
  readonly reportId: string;
  readonly reportType: ReportType;
  readonly context: ReportContext;
  readonly point: GeoPoint;
  // Marked from a distance (decision 20261011-0400): merges only on a matching photo, never on distance alone.
  readonly longRange: boolean;
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
  // Scan frames of one spot and type share this site id, so they found or join one site even when merged at once.
  readonly spotSiteId?: string;
}
