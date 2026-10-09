import type { Site as SiteFeature } from "../../contracts/index.gen.js";

export type { SiteFeature };
export type SiteProperties = SiteFeature["properties"];
export type ReportType = SiteProperties["report_type"];
export type ReportContext = SiteProperties["context"];
export type Verification = SiteProperties["verification"];
export type SiteLocation = SiteProperties["location"];
export type SiteBrand = SiteProperties["brands"][number];
export type PhotoUrls = SiteProperties["photo_urls"];
export type VoteChoice = "confirm" | "reject";

// Inline vote result body in contracts/README.md.
export interface VoteResult {
  readonly site_id: string;
  readonly votes: SiteProperties["votes"];
  readonly verification: Verification;
}

// Kept on the site item but never in the Feature: device tokens must not reach GeoJSON.
export interface SiteInternals {
  readonly reportIds: readonly string[];
  readonly reporterDevices: readonly string[];
  readonly meTooCount: number;
  readonly embeddingKey: string | null;
  readonly pendingCleanupId: string | null;
  readonly version: number;
}

export interface SiteState {
  readonly feature: SiteFeature;
  readonly internals: SiteInternals;
}
