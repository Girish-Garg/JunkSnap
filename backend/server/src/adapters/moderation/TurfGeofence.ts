import { readFileSync } from "node:fs";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { MultiPolygon, Polygon } from "geojson";
import { z } from "zod";
import { ConfigError } from "../../domain/errors.js";
import type { GeoPoint } from "../../domain/moderation/GeoPoint.js";
import type { Geofence } from "../../ports/moderation/Geofence.js";

interface Planar {
  readonly x: number;
  readonly y: number;
}

const Position = z.array(z.number()).min(2);
const Ring = z.array(Position);
const Area = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: z.array(Ring) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(Ring)) }),
]);
const OutlineFile = z.object({ type: z.literal("FeatureCollection"), features: z.array(z.object({ geometry: Area })).min(1) });

// Point-in-polygon, widened by a buffer in degrees to absorb outline simplification and GPS drift at coasts and borders.
export class TurfGeofence implements Geofence {
  readonly #area: Polygon | MultiPolygon;
  readonly #rings: readonly (readonly Planar[])[];
  readonly #bufferDeg: number;

  constructor(area: Polygon | MultiPolygon, bufferDeg: number) {
    this.#area = area;
    this.#bufferDeg = bufferDeg;
    const polygons = area.type === "Polygon" ? [area.coordinates] : area.coordinates;
    this.#rings = polygons.flat().map((ring) => ring.map(([x = 0, y = 0]) => ({ x, y })));
  }

  // Reads features[0].geometry of a GeoJSON FeatureCollection.
  static fromFile(path: string, bufferDeg: number): TurfGeofence {
    const area = OutlineFile.safeParse(TurfGeofence.#readJson(path)).data?.features[0]?.geometry;
    if (area === undefined) {
      throw new ConfigError(`${path} is not a FeatureCollection whose first feature is a polygon`);
    }
    return new TurfGeofence(area, bufferDeg);
  }

  static #readJson(path: string): unknown {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      throw new ConfigError(`cannot read the outline ${path}`, { cause: error });
    }
  }

  covers(point: GeoPoint): boolean {
    return booleanPointInPolygon([point.lon, point.lat], this.#area) || this.#nearEdge({ x: point.lon, y: point.lat });
  }

  #nearEdge(point: Planar): boolean {
    return this.#rings.some((ring) =>
      ring.some((start, index) => {
        const end = ring[index + 1];
        return end !== undefined && this.#distanceToSegment(point, start, end) <= this.#bufferDeg;
      }),
    );
  }

  #distanceToSegment(point: Planar, start: Planar, end: Planar): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared === 0 ? 0 : ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const t = Math.min(1, Math.max(0, along));
    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
  }
}
