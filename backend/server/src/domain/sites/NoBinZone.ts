import { GeoPoint } from "./GeoPoint.js";
import type { MergeRadii } from "./SiteRules.js";
import type { MergedReport, ReportType, SiteProperties } from "./SiteTypes.js";

// Each no-bin report says there is no dustbin within this radius; fixed by the site contract (zone_radius_m const 1000).
export const ZONE_RADIUS_M = 1000;

// Decision 20261010-1630: a no-bin report joins the nearest open zone within ZONE_MERGE_RADIUS_M of its centre.
export function mergeRadiusM(type: ReportType, radii: MergeRadii): number {
  return type === "no_bin" ? radii.zoneMergeRadiusM : radii.siteMergeRadiusM;
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
