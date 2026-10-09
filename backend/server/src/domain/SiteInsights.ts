import type { Material } from "./AreaInsights.js";
import type { PlaceKind } from "./SensitivePlace.js";

// The parts of site.insights (contracts v1.1, PR #25) that area insights read.
export interface SiteInsights {
  readonly reports: number;
  readonly composition: readonly { readonly material: Material; readonly share_pct: number }[];
  readonly hazards: readonly { readonly hazard: string }[];
  readonly near: readonly { readonly kind: PlaceKind; readonly distance_m: number }[];
}

export interface CompositionEstimate {
  readonly reports: number;
  readonly shares: SiteInsights["composition"];
}

export interface BrandSighting {
  readonly brand: string;
  readonly parentCompany: string;
  readonly confidence: number;
}
