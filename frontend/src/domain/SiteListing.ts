import type { QueuedReport } from './QueuedReport';
import type { SiteProperties } from './Site';

// Report statuses a reporter can still take back: the report sits on a site nobody has verified yet.
const WITHDRAWABLE: ReadonlySet<string> = new Set(['unverified', 'rejected', 'community_check']);
const OFF_MAP: ReadonlySet<string> = new Set(['removed', 'cleaned', 'expired']);

/** Which sites the map shows, and when a reporter may withdraw (decisions 20261010-1530 and -1700). */
export class SiteListing {
  /** The active map leaves out rejected, removed, cleaned and expired sites, like GET /sites?bbox. */
  static onMap(site: Pick<SiteProperties, 'verification' | 'status'>): boolean {
    return site.verification !== 'rejected' && !OFF_MAP.has(site.status);
  }

  /** This phone's reports merged into the site that can still be withdrawn. */
  static mine(reports: readonly QueuedReport[], siteId: string): readonly QueuedReport[] {
    return reports.filter((report) => {
      const status = report.data.status;
      return status !== null && status.site_id === siteId && WITHDRAWABLE.has(status.status);
    });
  }

  /** Only an unverified site that is still standing takes reports back. */
  static canWithdraw(site: Pick<SiteProperties, 'verification' | 'status'>, mine: readonly QueuedReport[]): boolean {
    return mine.length > 0 && site.verification !== 'verified' && site.status !== 'removed';
  }
}
