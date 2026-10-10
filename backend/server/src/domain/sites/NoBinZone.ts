import { GeoPoint } from "./GeoPoint.js";
import type { MergedReport, ReportType, SiteProperties } from "./SiteTypes.js";

const SITE_MERGE_RADIUS_M = 40;
// Decision 20261010-1630: a no-bin report joins the nearest open zone whose centre is within 500 m.
const ZONE_MERGE_RADIUS_M = 500;
// Each no-bin report says there is no dustbin within this radius of where the reporter stood.
export const ZONE_RADIUS_M = 1000;
export const MAX_MERGE_RADIUS_M = ZONE_MERGE_RADIUS_M;

export function mergeRadiusM(type: ReportType): number {
  return type === "no_bin" ? ZONE_MERGE_RADIUS_M : SITE_MERGE_RADIUS_M;
}

// A zone's centre is the mean of its reports' points; a report stored before points were kept counts at the old centre.
export function zoneCentre(reports: readonly MergedReport[], current: GeoPoint): GeoPoint {
  const points = reports.map((report) => report.point ?? { lat: current.lat, lon: current.lon });
  const lat = points.reduce((total, point) => total + point.lat, 0) / Math.max(points.length, 1);
  const lon = points.reduce((total, point) => total + point.lon, 0) / Math.max(points.length, 1);
  return points.length === 0 ? current : new GeoPoint(lat, lon);
}

// Privacy: one person's no-bin report shows where they stood, so its zone is published to 3 decimals (about 100 m).
export function publishedPoint(centre: GeoPoint, site: Pick<SiteProperties, "report_type" | "backers">): GeoPoint {
  if (site.report_type !== "no_bin" || site.backers.count > 1) {
    return centre;
  }
  return new GeoPoint(Math.round(centre.lat * 1000) / 1000, Math.round(centre.lon * 1000) / 1000);
}
