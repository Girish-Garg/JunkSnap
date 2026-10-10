import type { FlagAuthor, StoredPhotoFlag } from "../../domain/flags/PhotoFlag.js";

export interface PhotoFlagStore {
  // Replaces the same person's earlier report of the same photo.
  put(flag: StoredPhotoFlag): Promise<void>;
  // Every current report of one photo, read after the write (strongly consistent).
  authorsOf(siteId: string, photoId: string): Promise<FlagAuthor[]>;
}

// Runs the site's community analysis later; the answer to the resident never waits for it.
export interface CommunityTrigger {
  textAccepted(siteId: string): void;
}
