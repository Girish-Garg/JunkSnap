/** Drops the phone's copies of a site after a write to it, so the next read cannot answer from before the write. */
export interface SiteCacheEviction {
  forgetSite(siteId: string): void;
}
