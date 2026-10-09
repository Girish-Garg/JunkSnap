import type { GeoPoint } from "../../domain/moderation/GeoPoint.js";
import type { PerceptualHash } from "../../domain/moderation/PerceptualHash.js";
import type { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";

export interface IndexedPhoto {
  readonly photoId: string;
  readonly hash: PerceptualHash;
  readonly location: GeoPoint;
}

export interface HashIndex {
  // At least every earlier photo within radiusM that this one may duplicate; on a retry it may include its own id.
  earlierPhotos(submission: PhotoSubmission, radiusM: number): Promise<IndexedPhoto[]>;
}
