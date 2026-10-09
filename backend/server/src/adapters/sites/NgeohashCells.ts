import ngeohash from "ngeohash";
import type { BoundingBox } from "../../domain/sites/BoundingBox.js";
import type { GeoPoint } from "../../domain/sites/GeoPoint.js";
import type { GeoCells } from "../../ports/sites/GeoCells.js";

// Precision 4: a cell is 0.3515625 deg of longitude by 0.17578125 deg of latitude.
const PRECISION = 4;

export class NgeohashCells implements GeoCells {
  covering(box: BoundingBox): string[] {
    return ngeohash.bboxes(box.minLat, box.minLon, box.maxLat, box.maxLon, PRECISION);
  }

  cellOf(point: GeoPoint): string {
    return ngeohash.encode(point.lat, point.lon, PRECISION);
  }
}
