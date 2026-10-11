import type { ReportRecord } from "../../domain/ReportRecord.js";
import { BoundingBox } from "../../domain/sites/BoundingBox.js";
import { GeoPoint } from "../../domain/sites/GeoPoint.js";
import { ReportPlacement } from "../../domain/ReportPlacement.js";
import type { NearbyVerifiedCounter } from "../../ports/NearbyVerifiedCounter.js";
import type { SiteFinder } from "../sites/SiteFinder.js";

// Verified reports on verified sites of the same type within the merge radius.
export class SiteNearbyCounter implements NearbyVerifiedCounter {
  readonly #finder: SiteFinder;
  readonly #radiusM: number;

  // radiusM: the photo-site merge radius (SITE_MERGE_RADIUS_M); the ml nearby feature never counts no-bin zones.
  constructor(finder: SiteFinder, radiusM: number) {
    this.#finder = finder;
    this.#radiusM = radiusM;
  }

  async count(report: ReportRecord): Promise<number> {
    const point = ReportPlacement.of(report).spot;
    const sites = await this.#finder.inBox(BoundingBox.around(point, this.#radiusM));
    const near = sites.filter(({ geometry, properties }) => {
      const [lon, lat] = geometry.coordinates;
      const same = properties.report_type === report.report_type && properties.verification === "verified";
      return same && point.distanceTo(new GeoPoint(lat, lon)) <= this.#radiusM;
    });
    return near.reduce((total, site) => total + site.properties.verified_count, 0);
  }
}
