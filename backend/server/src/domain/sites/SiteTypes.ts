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
// cleaned: the person says the waste is gone (decision 20261010-1700).
export type VoteChoice = "confirm" | "reject" | "cleaned";

// userId is null for a guest from before accounts.
export interface Voter {
  readonly deviceToken: string;
  readonly userId: string | null;
}

// Inline vote result body in contracts/README.md.
export interface VoteResult {
  readonly site_id: string;
  readonly votes: SiteProperties["votes"];
  readonly backers: SiteProperties["backers"];
  readonly verification: Verification;
}

// verified: the report belongs to a verified site (decision 20261010-1530).
export interface MergedReport {
  readonly reportId: string;
  readonly verified: boolean;
  readonly insights: ReportInsights | null;
  // Where the reporter stood; null for a report stored before points were kept. No-bin zones centre on these.
  readonly point: { readonly lat: number; readonly lon: number } | null;
}

// Kept on the site item but never in the Feature: device tokens and user ids must not reach GeoJSON.
export interface SiteInternals {
  readonly reports: readonly MergedReport[];
  readonly reporterDevices: readonly string[];
  readonly reporterUsers: readonly string[];
  // One id per person: the user id, else the device token; site.reporters is its length.
  readonly reporterIds: readonly string[];
  // People whose latest vote is yes or no; reporterIds are the photo people.
  readonly yesVoters: readonly string[];
  readonly noVoters: readonly string[];
  // True for a row written before decision 20261010-1530 that the backers migration has not counted yet.
  readonly needsBackerCount: boolean;
  // backers.count frozen when the site became verified, so a later yes-to-no flip never shows "9 of 10".
  readonly verifiedBackers: number | null;
  readonly meTooCount: number;
  readonly embeddingKey: string | null;
  readonly pendingCleanupId: string | null;
  // Reports their reporter withdrew (decision 20261010-1700): kept for the audit trail, never counted.
  readonly withdrawnReports: readonly string[];
  readonly version: number;
}

export interface SiteState {
  readonly feature: SiteFeature;
  readonly internals: SiteInternals;
}
