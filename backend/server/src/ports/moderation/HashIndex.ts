import type { GeoPoint } from "../../domain/moderation/GeoPoint.js";
import type { PerceptualHash } from "../../domain/moderation/PerceptualHash.js";

export interface IndexedPhoto {
  readonly photoId: string;
  readonly hash: PerceptualHash;
  readonly location: GeoPoint;
}

export interface HashIndex {
  // At least every moderated photo within radiusM; on a retry it may include the caller's own id.
  near(point: GeoPoint, radiusM: number): Promise<IndexedPhoto[]>;
}
