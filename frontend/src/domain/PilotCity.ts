import { BBox } from './BBox';
import type { LonLat, SiteFeature } from './Site';
import { SiteListing } from './SiteListing';

/**
 * Jodhpur, the pilot city: where the app always opens, for judges, first visits and people with no location.
 * The centre is the map's opening point; the bounds are the extent of the Jodhpur ward map
 * (data/boundaries/jodhpur_wards.geojson: 72.962 to 73.072 E, 26.221 to 26.356 N), rounded outwards.
 * The box is well under one GET /sites query (1 by 1 degree), so one request loads the whole city.
 */
export class PilotCity {
  static readonly centre: LonLat = [73.02, 26.27];
  static readonly bounds = new BBox(72.96, 26.22, 73.08, 26.36);

  static contains(point: LonLat): boolean {
    return PilotCity.bounds.contains(point);
  }

  /** The city's sites on the active map: never rejected, removed, cleaned or expired, never outside the city. */
  static sitesOf(sites: readonly SiteFeature[]): readonly SiteFeature[] {
    return sites.filter((site) => SiteListing.onMap(site.properties) && PilotCity.contains(site.geometry.coordinates));
  }
}
