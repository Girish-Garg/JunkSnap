import type { Site as SiteFeature, VerificationResult } from "../../contracts/index.gen.js";

export type { SiteFeature };
export type SiteProperties = SiteFeature["properties"];
export type ReportType = SiteProperties["report_type"];
export type ReportContext = SiteProperties["context"];
export type Verification = SiteProperties["verification"];
export type SiteLocation = SiteProperties["location"];
export type SiteBrand = SiteProperties["brands"][number];
export type PhotoUrls = SiteProperties["photo_urls"];
export type SiteInsights = NonNullable<SiteProperties["insights"]>;
export type NearPlace = SiteInsights["near"][number];
export type ReportInsights = NonNullable<VerificationResult["insights"]>;
export type VoteChoice = "confirm" | "reject";

// userId is null for a guest from before accounts.
export interface Voter {
  readonly deviceToken: string;
  readonly userId: string | null;
}

// Inline vote result body in contracts/README.md.
export interface VoteResult {
  readonly site_id: string;
  readonly votes: SiteProperties["votes"];
  readonly verification: Verification;
}

// verified: auto-verified by the models, or confirmed when votes settled the site.
export interface MergedReport {
  readonly reportId: string;
  readonly verified: boolean;
  readonly insights: ReportInsights | null;
}

// Kept on the site item but never in the Feature: device tokens and user ids must not reach GeoJSON.
export interface SiteInternals {
  readonly reports: readonly MergedReport[];
  readonly reporterDevices: readonly string[];
  readonly reporterUsers: readonly string[];
  readonly meTooCount: number;
  readonly embeddingKey: string | null;
  readonly pendingCleanupId: string | null;
  readonly version: number;
}

export interface SiteState {
  readonly feature: SiteFeature;
  readonly internals: SiteInternals;
}
