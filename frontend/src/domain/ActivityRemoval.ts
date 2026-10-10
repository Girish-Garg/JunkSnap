import type { ReportStatusView } from './ReportStatus';

/**
 * What deleting an Activity row does (decision 20261010-1700):
 * withdraw: a report backs a site nobody has verified yet, so it is withdrawn from the site first;
 * verified: the site is verified by neighbours and stays on the map, the row is only hidden;
 * local: rejected, failed, withdrawn or never on a site, so the row just leaves this phone.
 */
export type RemovalKind = 'withdraw' | 'verified' | 'local';

export interface RemovalOutcome {
  readonly kind: RemovalKind;
  /** Sites that left the map because this phone's reports were their only ones. */
  readonly sitesRemoved: number;
  /** A verified site still holds one of the deleted reports. */
  readonly verifiedKept: boolean;
}

const WITHDRAWABLE: ReadonlySet<string> = new Set(['unverified', 'community_check']);

/** Pure rules over the last known statuses of the reports behind one row. */
export class ActivityRemoval {
  static kindOf(statuses: readonly (ReportStatusView | null)[]): RemovalKind {
    if (ActivityRemoval.withdrawSites(statuses).length > 0) return 'withdraw';
    return statuses.some((status) => status?.status === 'verified') ? 'verified' : 'local';
  }

  /** Each unverified site once, so one withdrawal covers every frame of a scan on it. */
  static withdrawSites(statuses: readonly (ReportStatusView | null)[]): readonly string[] {
    const sites = statuses.flatMap((status) => (status?.site_id && WITHDRAWABLE.has(status.status) ? [status.site_id] : []));
    return [...new Set(sites)];
  }
}
