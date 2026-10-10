import type { GeoPoint } from "../sites/GeoPoint.js";
import type { NearPlace, SiteInsights } from "../sites/SiteTypes.js";

// A known bin or collection point: an OpenStreetMap disposal-layer feature or a reviewed ward-record disposal point.
export interface KnownBin {
  readonly point: GeoPoint;
  readonly ref: string;
  readonly source: NearPlace["source"];
}

export type NearestBin = NonNullable<SiteInsights["nearest_bin"]>;

export interface BinMeasure {
  readonly nearest_bin: NearestBin | null;
  readonly no_bin_within_3km: boolean | null;
}

// Nothing known about bins at this place.
export const UNMEASURED: BinMeasure = { nearest_bin: null, no_bin_within_3km: null };
