import type { WardScores } from "../contracts/index.gen.js";
import type { InsightSource, Material } from "../contracts/site.gen.js";

export type { InsightSource, Material };

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

// ward_scores.insights with plain arrays: the generated type spells maxItems as tuple unions; the repository validates it.
export interface AreaInsights {
  composition: { value: MaterialShare[] | null; reports: number; sources: InsightSource[]; reason: InsightReason };
  hazardous_share_pct: { value: number | null; hazardous_sites: number; sites: number; reason: InsightReason };
  top_brands: { value: BrandCount[] | null; labels: number; reason: InsightReason };
  repeat_spots: { value: string[] | null; count: number; reason: InsightReason };
  hour_of_day: { value: number[] | null; reports: number; reason: InsightReason };
  day_of_week: { value: number[] | null; reports: number; reason: InsightReason };
  near_school_or_water_count: { value: number | null; sites: number; reason: InsightReason };
}

export type ComputedAreaScores = Omit<WardScores, "insights"> & { insights: AreaInsights };
