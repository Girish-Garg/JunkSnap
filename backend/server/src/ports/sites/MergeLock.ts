// Serialises the merger's "pick a site, or found one" step for reports whose merge areas share a geohash4 cell, so two
// reports of one spot handled in the same worker batch cannot both found a site. The in-process lock is enough for one
// worker replica; more than one replica needs a shared lock (for example a conditional DynamoDB lock item per cell).
export interface MergeLock {
  // Runs body once every key is held, and always releases them, also when body throws.
  hold<T>(keys: readonly string[], body: () => Promise<T>): Promise<T>;
}
