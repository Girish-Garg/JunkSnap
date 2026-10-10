import type { Place } from '../../domain/PlaceSearch';
import type { LonLat } from '../../domain/Site';

/** "Move the map to these points"; a new object each time, so asking twice moves twice. */
export interface CameraRequest {
  readonly points: readonly LonLat[];
  /** Zoom for a single point, such as a seat's middle; a site gets street level. */
  readonly zoom?: number;
}

// About 25 km across a phone: an assembly or Lok Sabha seat around its middle.
const SEAT_ZOOM = 10.5;

/** Where a search result moves the map: its loaded sites, else the middle of the seat. */
export class PlaceCamera {
  static for({ sites, point }: Pick<Place, 'sites' | 'point'>): CameraRequest {
    if (sites.length > 0 || !point) return { points: sites.map((site) => site.geometry.coordinates) };
    return { points: [point], zoom: SEAT_ZOOM };
  }
}
