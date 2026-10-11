import type { SiteProperties } from './Site';

const SITE_ID = /^site_[a-z0-9_]{1,40}$/;

/** Decision 20261011-1730-hem-merged-sites: a same-spot duplicate merged into an older site; its links lead there. */
export class MergedSite {
  /** The site to open instead: only a removed site that names another, well-formed site id. */
  static target(site: Pick<SiteProperties, 'site_id' | 'status' | 'merged_into'>): string | null {
    const into = site.merged_into;
    if (site.status !== 'removed' || typeof into !== 'string' || into === site.site_id) return null;
    return SITE_ID.test(into) ? into : null;
  }
}
