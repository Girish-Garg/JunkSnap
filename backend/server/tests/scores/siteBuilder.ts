import type { AreaFactSheet } from "../../src/domain/AreaFactSheet.js";
import type { AreaRef } from "../../src/domain/AreaKey.js";
import { AreaSite, type AreaSiteProps } from "../../src/domain/AreaSite.js";
import { GeoPoint } from "../../src/domain/GeoPoint.js";
import type { SiteInsights } from "../../src/domain/SiteInsights.js";

export const NOW = new Date("2026-10-20T00:00:00Z");
export const WARD: AreaRef = { kind: "ward", id: "jodhpur-south-mc-w37", name: "Ward 37" };
export const HERE = new GeoPoint(26.2614, 73.0042);
export const NO_FACTS: AreaFactSheet = { areaKm2: null, disposalPoints: [], sensitivePlaces: [] };

// A point the given metres due north of HERE.
export function northOf(metres: number): GeoPoint {
  return new GeoPoint(HERE.lat + (metres / 6_371_000) * (180 / Math.PI), HERE.lon);
}

export function insights(overrides: Partial<SiteInsights> = {}): SiteInsights {
  return { reports: 1, composition: [], hazards: [], near: [], ...overrides };
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
    areas: [WARD],
    brands: [],
    insights: null,
    reportTimes: [],
    ...overrides,
  });
}
