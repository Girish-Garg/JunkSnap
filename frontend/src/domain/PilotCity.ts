import type { BBox } from './BBox';
import type { LonLat, SiteFeature } from './Site';
import { SiteListing } from './SiteListing';

/**
 * The pilot city (Jodhpur by default, VITE_PILOT_CENTRE and VITE_PILOT_BOUNDS): where the app always opens, for
 * judges, first visits and people with no location. The centre is the map's opening point; the bounds are the extent
 * of the city's ward map (data/boundaries/jodhpur_wards.geojson: 72.962 to 73.072 E, 26.221 to 26.356 N), rounded
 * outwards. The box is well under one GET /sites query (1 by 1 degree), so one request loads the whole city.
 */
export class PilotCity {
  readonly centre: LonLat;
  readonly bounds: BBox;

  constructor(centre: LonLat, bounds: BBox) {
    this.centre = centre;
    this.bounds = bounds;
  }

  /** The box takes in the whole city, so one GET /sites over it also answers for the city. */
  within(box: BBox): boolean {
    const { minLon, minLat, maxLon, maxLat } = this.bounds;
    return box.contains([minLon, minLat]) && box.contains([maxLon, maxLat]);
  }

  contains(point: LonLat): boolean {
    return this.bounds.contains(point);
  }

  /** The city's sites on the active map: never rejected, removed, cleaned or expired, never outside the city. */
  sitesOf(sites: readonly SiteFeature[]): readonly SiteFeature[] {
    return sites.filter((site) => SiteListing.onMap(site.properties) && this.contains(site.geometry.coordinates));
  }

  /** Two corners that frame the whole city. */
  frame(): readonly LonLat[] {
    const { minLon, minLat, maxLon, maxLat } = this.bounds;
    return [[minLon, minLat], [maxLon, maxLat]];
  }
}
