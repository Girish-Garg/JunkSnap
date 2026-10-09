import type { GeoPoint, PlanePoint, Position } from "./GeoPoint.js";

export const PLACE_KINDS = ["school", "hospital", "water_body", "open_drain"] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];

type Segment = readonly [PlanePoint, PlanePoint];

// Any GeoJSON shape as paths: a point is a one-position path; an enclosing place's first path is its outer ring.
export class SensitivePlace {
  readonly kind: PlaceKind;
  readonly #paths: readonly (readonly Position[])[];
  readonly #enclosing: boolean;

  constructor(kind: PlaceKind, paths: readonly (readonly Position[])[], enclosing: boolean) {
    this.kind = kind;
    this.#paths = paths;
    this.#enclosing = enclosing;
  }

  distanceFrom(point: GeoPoint): number {
    const paths = this.#paths.map((path) => path.map((position) => point.project(position)));
    const outer = paths[0];
    if (this.#enclosing && outer !== undefined && SensitivePlace.#surroundsOrigin(outer)) {
      return 0;
    }
    return Math.min(...paths.map((path) => SensitivePlace.#distanceToPath(path)));
  }

  static #distanceToPath(path: readonly PlanePoint[]): number {
    const segments = path.map((end, index): Segment => [path[index - 1] ?? end, end]);
    return Math.min(...segments.map(([start, end]) => SensitivePlace.#distanceToSegment(start, end)));
  }

  static #distanceToSegment(start: PlanePoint, end: PlanePoint): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared === 0 ? 0 : -(start.x * dx + start.y * dy) / lengthSquared;
    const t = Math.max(0, Math.min(1, along));
    return Math.hypot(start.x + t * dx, start.y + t * dy);
  }

  // Ray cast from the origin along +x; the ring's last position may repeat its first.
  static #surroundsOrigin(ring: readonly PlanePoint[]): boolean {
    const crossings = ring.filter((end, index) => {
      const start = ring.at(index - 1) ?? end;
      if (start.y > 0 === end.y > 0) {
        return false;
      }
      return start.x - (start.y * (end.x - start.x)) / (end.y - start.y) > 0;
    });
    return crossings.length % 2 === 1;
  }
}
