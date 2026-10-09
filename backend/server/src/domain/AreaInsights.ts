import type { WardScores } from "../contracts/index.gen.js";

// Mirrors ward_scores.insights from the contracts v1.1 PR (#25); swap for the generated type once it merges.
export const MATERIALS = [
  "plastic",
  "organic",
  "construction_debris",
  "paper",
  "glass",
  "metal",
  "textile",
  "e_waste",
  "medical",
] as const;

export type Material = (typeof MATERIALS)[number];

export type InsightReason = null | "too_few_reports" | "no_data";

export interface MaterialShare {
  material: Material;
  share_pct: number;
}

export interface BrandCount {
  brand: string;
  parent_company: string;
  sites: number;
  labels: number;
}

export interface AreaInsights {
  composition: { value: MaterialShare[] | null; reports: number; reason: InsightReason };
  hazardous_share_pct: { value: number | null; hazardous_sites: number; sites: number; reason: InsightReason };
  top_brands: { value: BrandCount[] | null; labels: number; reason: InsightReason };
  repeat_spots: { value: string[] | null; count: number; reason: InsightReason };
  hour_of_day: { value: number[] | null; reports: number; reason: InsightReason };
  day_of_week: { value: number[] | null; reports: number; reason: InsightReason };
  near_school_or_water_count: { value: number | null; sites: number; reason: InsightReason };
}

// A stored row; rows the worker seeds may lack insights, rows the scores job writes always have them.
export type AreaScoresRow = WardScores & { insights?: AreaInsights };

export type ComputedAreaScores = WardScores & { insights: AreaInsights };
