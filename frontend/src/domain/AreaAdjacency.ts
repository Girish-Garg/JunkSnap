import type { Position } from 'geojson';
import { ringsOf, type AreaPolygons } from './AreaShapes';

export type Neighbours = ReadonlyMap<string, ReadonlySet<string>>;

const pointKey = (point: Position): string => `${String(point[0])},${String(point[1])}`;

/**
 * Which areas touch. scripts/simplify_boundaries.py simplifies each layer as one coverage and rounds every
 * coordinate, so neighbours keep identical vertices along their shared edge: two areas that share any vertex
 * touch. A corner-only touch counts too, so even areas meeting at a point get different colours.
 */
export class AreaAdjacency {
  static of(polygons: AreaPolygons): Neighbours {
    const owners = new Map<string, Set<string>>();
    for (const feature of polygons.features) {
      const keys = new Set(ringsOf(feature.geometry).flat().map(pointKey));
      keys.forEach((key) => AreaAdjacency.#add(owners, key, feature.properties.id));
    }
    const neighbours = new Map<string, Set<string>>(polygons.features.map((feature) => [feature.properties.id, new Set()]));
    for (const ids of owners.values()) {
      if (ids.size > 1) AreaAdjacency.#link(neighbours, ids);
    }
    return neighbours;
  }

  static #add(owners: Map<string, Set<string>>, key: string, id: string): void {
    const ids = owners.get(key);
    if (ids) ids.add(id);
    else owners.set(key, new Set([id]));
  }

  static #link(neighbours: Map<string, Set<string>>, ids: ReadonlySet<string>): void {
    for (const id of ids) {
      const own = neighbours.get(id);
      ids.forEach((other) => other !== id && own?.add(other));
    }
  }
}
