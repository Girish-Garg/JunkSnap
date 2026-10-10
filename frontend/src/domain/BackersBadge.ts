import type { SiteProperties } from './Site';

/** The "n/10" label under an unverified pin; empty once verified (decision 20261010-1530). */
export class BackersBadge {
  static of(site: SiteProperties): string {
    if (site.verification !== 'unverified') return '';
    return `${Math.min(site.backers.count, site.backers.needed)}/${site.backers.needed}`;
  }
}
