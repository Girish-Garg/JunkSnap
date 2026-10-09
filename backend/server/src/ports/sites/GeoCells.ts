import type { BoundingBox } from "../../domain/sites/BoundingBox.js";

export interface GeoCells {
  // Every geohash4 cell that overlaps the box.
  covering(box: BoundingBox): string[];
}
