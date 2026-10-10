import type { AreaMarker } from './AreaMarkers';

/** Which map legend entries apply now; pins always do, area entries only once the map draws them. */
export interface LegendEntries {
  /** Seats are drawn: their neighbour tints, the focus outline, and the dashed "out of date" outline. */
  readonly boundaries: boolean;
  /** Some seat shows a verified report count (photo marker). */
  readonly counts: boolean;
  /** Some seat shows a score (score fill, bars marker, its count and the pilot flag). */
  readonly scores: boolean;
}

/** The legend never explains a colour or marker the map is not showing, such as scores before any exist. */
export class LegendKeys {
  static of(boundaries: boolean, markers: ReadonlyMap<string, AreaMarker>): LegendEntries {
    const bases = new Set([...markers.values()].map((marker) => marker.basis));
    return { boundaries, counts: boundaries && bases.has('count'), scores: boundaries && bases.has('score') };
  }
}
