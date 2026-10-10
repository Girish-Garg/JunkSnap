import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';

/** The map's area polygons (public/boundaries/areas.geojson): each feature carries its area id. */
export type AreaPolygons = FeatureCollection<Polygon | MultiPolygon, { readonly id: string }>;

/** Every ring of a polygon or multipolygon, outer rings and holes alike. */
export function ringsOf(geometry: Polygon | MultiPolygon): readonly Position[][] {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
}

// Whether the edge a-b crosses the ray running east from the point.
function crosses(a: Position, b: Position, [x, y]: readonly [number, number]): boolean {
  const [ax, ay, bx, by] = [Number(a[0]), Number(a[1]), Number(b[0]), Number(b[1])];
  return ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax;
}

// Even-odd ray cast: a point is inside when the ray crosses the rings an odd number of times.
function crossings(ring: readonly Position[], point: readonly [number, number]): number {
  return ring.reduce((count, current, i) => {
    const previous = ring.at(i - 1);
    return previous && crosses(current, previous, point) ? count + 1 : count;
  }, 0);
}

/** Which area a point lies in, from the same polygons the map draws. */
export class AreaShapes {
  readonly polygons: AreaPolygons;

  constructor(polygons: AreaPolygons) {
    this.polygons = polygons;
  }

  /** The id of the area holding the point (lon, lat), or null outside every area. */
  containing(point: readonly [number, number]): string | null {
    const hit = this.polygons.features.find((feature) => {
      const total = ringsOf(feature.geometry).reduce((sum, ring) => sum + crossings(ring, point), 0);
      return total % 2 === 1;
    });
    return hit?.properties.id ?? null;
  }
}
