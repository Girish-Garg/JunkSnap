import { AreaAdjacency, type Neighbours } from './AreaAdjacency';
import { AreaShapes, type AreaPolygons } from './AreaShapes';

/**
 * Gives every area one of `colours` palette slots so that no two neighbours share one (graph colouring).
 * Welsh-Powell order: the most connected areas first, ties by id, so the result never changes between loads.
 * Each area takes, of the slots no coloured neighbour holds, the one used least so far, spreading the palette
 * evenly. Map areas are planar, so 4 slots would always do in theory; greedy needs a few more, and the tests
 * check the real areas.geojson needs no more than the palette has. Should a slot ever run out, the area takes
 * the least-used slot and a neighbour may repeat it, rather than going uncoloured.
 */
export class AreaColouring {
  /** The polygons with their tint slots; a file without a feature list gives no areas. */
  static shapes(polygons: AreaPolygons, colours: number): AreaShapes {
    const usable: AreaPolygons = Array.isArray(polygons.features) ? polygons : { type: 'FeatureCollection', features: [] };
    return new AreaShapes(usable, AreaColouring.of(AreaAdjacency.of(usable), colours));
  }

  static of(neighbours: Neighbours, colours: number): ReadonlyMap<string, number> {
    const order = [...neighbours.keys()].sort((a, b) => AreaColouring.#degree(neighbours, b) - AreaColouring.#degree(neighbours, a) || a.localeCompare(b));
    const slots = new Map<string, number>();
    const used = new Array<number>(colours).fill(0);
    for (const id of order) {
      const taken = new Set([...(neighbours.get(id) ?? [])].map((other) => slots.get(other)));
      const slot = AreaColouring.#leastUsed(used, (candidate) => !taken.has(candidate)) ?? AreaColouring.#leastUsed(used, () => true) ?? 0;
      slots.set(id, slot);
      used[slot] = (used[slot] ?? 0) + 1;
    }
    return slots;
  }

  static #degree(neighbours: Neighbours, id: string): number {
    return neighbours.get(id)?.size ?? 0;
  }

  // The lowest slot among the least used of those allowed; undefined when none is allowed.
  static #leastUsed(used: readonly number[], allowed: (slot: number) => boolean): number | undefined {
    let best: number | undefined;
    used.forEach((count, slot) => {
      if (allowed(slot) && (best === undefined || count < (used[best] ?? 0))) best = slot;
    });
    return best;
  }
}
