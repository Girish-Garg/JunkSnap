import type { BoundingBox } from "../../domain/sites/BoundingBox.js";
import type { GeoPoint } from "../../domain/sites/GeoPoint.js";

export interface GeoCells {
  // Every geohash4 cell that overlaps the box.
  covering(box: BoundingBox): string[];
  // The geohash4 cell a site with this point is indexed under (the sites table's geohash4).
  cellOf(point: GeoPoint): string;
}
