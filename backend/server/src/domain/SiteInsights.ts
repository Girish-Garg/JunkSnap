import type { Site } from "../contracts/index.gen.js";

export type SiteInsights = NonNullable<Site["properties"]["insights"]>;

export type PlaceKind = SiteInsights["near"][number]["kind"];

export interface CompositionEstimate {
  readonly reports: number;
  readonly shares: SiteInsights["composition"];
}

export interface BrandSighting {
  readonly brand: string;
  readonly parentCompany: string;
  readonly confidence: number;
}
