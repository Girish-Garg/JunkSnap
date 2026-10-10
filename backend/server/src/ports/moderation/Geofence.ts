import type { GeoPoint } from "../../domain/moderation/GeoPoint.js";

export interface Geofence {
  covers(point: GeoPoint): boolean;
}
