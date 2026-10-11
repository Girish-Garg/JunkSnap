import type { MapFeature, MapLayer } from "../domain/MapLayer.js";
import type { NearPlace } from "../domain/sites/SiteTypes.js";

const METRES_PER_DEGREE_LAT = 110_574;
const METRES_PER_DEGREE_LON_AT_EQUATOR = 111_320;

type Xy = readonly [number, number];

// Sensitive places within radiusM (NEAR_PLACES_RADIUS_M) of a site, nearest first; distance to the nearest vertex or edge.
export class NearPlacesFinder {
  readonly #layers: readonly MapLayer[];
  readonly #radiusM: number;

  constructor(layers: readonly MapLayer[], radiusM: number) {
    this.#layers = layers;
    this.#radiusM = radiusM;
  }

  near(lat: number, lon: number): NearPlace[] {
    const places = this.#layers.flatMap((layer) =>
      layer.features.map((feature) => ({
        kind: layer.kind,
        distance_m: Math.round(NearPlacesFinder.#distance(lat, lon, feature)),
        ref: feature.ref,
        source: layer.source,
      })),
    );
    return places.filter((place) => place.distance_m <= this.#radiusM).sort((a, b) => a.distance_m - b.distance_m);
  }

  // A local flat projection is exact enough within a few hundred metres.
  static #distance(lat: number, lon: number, feature: MapFeature): number {
    const scale = Math.cos((lat * Math.PI) / 180) * METRES_PER_DEGREE_LON_AT_EQUATOR;
    const xy = ([pLat, pLon]: readonly [number, number]): Xy => [(pLon - lon) * scale, (pLat - lat) * METRES_PER_DEGREE_LAT];
    const points = feature.coords.map(xy);
    // A single place is a zero-length segment.
    const starts = points.length === 1 ? points : points.slice(0, -1);
    const ends = points.length === 1 ? points : points.slice(1);
    return Math.min(...starts.map((start, index) => NearPlacesFinder.#toSegment(start, ends[index] ?? start)));
  }

  // Distance from the origin (the site) to the segment a-b.
  static #toSegment(a: Xy, b: Xy): number {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / lengthSquared));
    return Math.hypot(a[0] + t * dx, a[1] + t * dy);
  }
}
