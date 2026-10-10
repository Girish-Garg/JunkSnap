import type { ReportRecord } from "../../domain/ReportRecord.js";
import { BoundingBox } from "../../domain/sites/BoundingBox.js";
import { GeoPoint } from "../../domain/sites/GeoPoint.js";
import { mergeRadiusM } from "../../domain/sites/NoBinZone.js";

// The photo-site merge radius; the ml nearby feature never counts no-bin zones.
const MERGE_RADIUS_M = mergeRadiusM("waste_dump");
import type { NearbyVerifiedCounter } from "../../ports/NearbyVerifiedCounter.js";
import type { SiteFinder } from "../sites/SiteFinder.js";

// Verified reports on verified sites of the same type within the merge radius.
export class SiteNearbyCounter implements NearbyVerifiedCounter {
  readonly #finder: SiteFinder;

  constructor(finder: SiteFinder) {
    this.#finder = finder;
  }

  async count(report: ReportRecord): Promise<number> {
    const point = new GeoPoint(report.gps.lat, report.gps.lon);
    const sites = await this.#finder.inBox(BoundingBox.around(point, MERGE_RADIUS_M));
    const near = sites.filter(({ geometry, properties }) => {
      const [lon, lat] = geometry.coordinates;
      const same = properties.report_type === report.report_type && properties.verification === "verified";
      return same && point.distanceTo(new GeoPoint(lat, lon)) <= MERGE_RADIUS_M;
    });
    return near.reduce((total, site) => total + site.properties.verified_count, 0);
  }
}
