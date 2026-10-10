import { readFileSync } from "node:fs";
import type { InsightSource } from "../../src/contracts/site.gen.js";
import type { AreaFactSheet } from "../../src/domain/AreaFactSheet.js";
import type { AreaRef } from "../../src/domain/AreaKey.js";
import { AreaSite, type AreaSiteProps } from "../../src/domain/AreaSite.js";
import { GeoPoint } from "../../src/domain/GeoPoint.js";
import type { PlaceKind, SiteInsights } from "../../src/domain/SiteInsights.js";

export const NOW = new Date("2026-10-20T00:00:00Z");
export const WARD: AreaRef = { kind: "ward", id: "jodhpur-mc-w37", name: "Ward 37" };
export const HERE = new GeoPoint(26.2614, 73.0042);
export const NO_FACTS: AreaFactSheet = { areaKm2: null, placesMapped: false };
export const YOLO: InsightSource = { signal: "yolo", provider: "junksnap", model: "yolo-junk-s", version: "v1" };
export const JUDGE: InsightSource = { signal: "vision_judge", provider: "bedrock", model: "global.anthropic.claude-sonnet-4-6", version: "4.6" };

export function readContract<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../../../../contracts/${path}`, import.meta.url), "utf8")) as T;
}

// A point the given metres due north of HERE.
export function northOf(metres: number): GeoPoint {
  return new GeoPoint(HERE.lat + (metres / 6_371_000) * (180 / Math.PI), HERE.lon);
}

export function share(material: SiteInsights["composition"][number]["material"], pct: number, source = YOLO) {
  return { material, share_pct: pct, reports: 1, sources: [source] as [InsightSource] };
}

export function nearPlace(kind: PlaceKind, distance: number): SiteInsights["near"][number] {
  const source = { source_url: "https://overpass-api.de/api/interpreter", fetched_at: "2026-10-10T01:00:00Z", page_sha256: "0".repeat(64) };
  return { kind, distance_m: distance, ref: "osm:node/1", source };
}

// Site insights with a measured nearest bin; null distance means no bin known in the searched rings.
export function binned(distance: number | null, radius = 3000): SiteInsights {
  const source = { source_url: "https://overpass-api.de/api/interpreter", fetched_at: "2026-10-10T01:00:00Z", page_sha256: "0".repeat(64) };
  const nearest_bin = distance === null ? null : { distance_m: distance, ref: "osm:node/9", source };
  return insights({ nearest_bin, no_bin_within_3km: distance === null || distance > radius });
}

export function insights(overrides: Partial<SiteInsights> = {}): SiteInsights {
  return { reports: 1, composition: [], size_class: null, hazards: [], near: [], ...overrides };
}

let counter = 0;

export function site(overrides: Partial<AreaSiteProps> = {}): AreaSite {
  counter += 1;
  return new AreaSite({
    siteId: `site_t_${counter}`,
    reportType: "waste_dump",
    context: "vacant_plot",
    status: "open",
    verification: "verified",
    verifiedCount: 1,
    firstReportedAt: "2026-10-10T00:00:00Z",
    cleanedAt: null,
    pilot: false,
    burning: false,
    point: HERE,
    localBodyId: "jodhpur-mc",
    areas: [WARD],
    brands: [],
    insights: null,
    reportTimes: [],
    ...overrides,
  });
}
