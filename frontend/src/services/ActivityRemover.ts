import { ActivityRemoval, type RemovalKind, type RemovalOutcome } from '../domain/ActivityRemoval';
import { ApiError } from '../domain/ApiError';
import type { QueuedReport } from '../domain/QueuedReport';
import type { QueuedScan } from '../domain/QueuedScan';
import type { ReportStatusView } from '../domain/ReportStatus';
import type { WithdrawalResult } from '../domain/SiteActions';
import type { ReportApi } from './ReportApi';
import type { ReportQueue } from './ReportQueue';
import type { ScanQueue } from './ScanQueue';

export interface ActivityRemoverPorts {
  readonly reports: Pick<ReportQueue, 'remove'>;
  readonly scans: Pick<ScanQueue, 'remove'>;
  /** GET /reports/{id}, for a scan's frame reports. */
  readonly statuses: Pick<ReportApi, 'status'>;
  /** DELETE /sites/{id}/reports/mine, behind the sign-in gate. */
  readonly sites: { withdraw(siteId: string): Promise<WithdrawalResult> };
  /** Deleted report ids, so the server's list never brings the row back. */
  readonly dismissed: { add(reportId: string): Promise<void> };
}

// Already withdrawn, or verified in the meantime: neither stops the row from leaving this phone.
const SETTLED: ReadonlySet<string> = new Set(['not_found', 'site_verified']);

/** Deletes an Activity row: withdraws its reports from unverified sites, then drops it from this phone. */
export class ActivityRemover {
  readonly #ports: ActivityRemoverPorts;

  constructor(ports: ActivityRemoverPorts) {
    this.#ports = ports;
  }

  planReport(report: QueuedReport): RemovalKind {
    return ActivityRemoval.kindOf([report.data.status]);
  }

  async removeReport(report: QueuedReport): Promise<RemovalOutcome> {
    const outcome = await this.#withdraw([report.data.status]);
    if (report.data.report_id) await this.#ports.dismissed.add(report.data.report_id);
    await this.#ports.reports.remove(report.id);
    return outcome;
  }

  /** Reads each frame report's status first, since frames are made on the server. */
  async planScan(scan: QueuedScan): Promise<RemovalKind> {
    return ActivityRemoval.kindOf(await this.#frames(scan));
  }

  async removeScan(scan: QueuedScan): Promise<RemovalOutcome> {
    const outcome = await this.#withdraw(await this.#frames(scan));
    await this.#ports.scans.remove(scan.id);
    return outcome;
  }

  async #withdraw(statuses: readonly (ReportStatusView | null)[]): Promise<RemovalOutcome> {
    let sitesRemoved = 0;
    let verifiedKept = statuses.some((status) => status?.status === 'verified');
    for (const siteId of ActivityRemoval.withdrawSites(statuses)) {
      const result = await this.#withdrawFrom(siteId);
      sitesRemoved += result.removed ? 1 : 0;
      verifiedKept ||= result.verified;
    }
    return { kind: ActivityRemoval.kindOf(statuses), sitesRemoved, verifiedKept };
  }

  async #withdrawFrom(siteId: string): Promise<{ readonly removed: boolean; readonly verified: boolean }> {
    try {
      return { removed: (await this.#ports.sites.withdraw(siteId)).site_removed, verified: false };
    } catch (error) {
      if (!(error instanceof ApiError && SETTLED.has(error.code))) throw error;
      return { removed: false, verified: error.code === 'site_verified' };
    }
  }

  // A frame the api cannot show (deleted, not this user's) counts as never on a site.
  async #frames(scan: QueuedScan): Promise<(ReportStatusView | null)[]> {
    const ids = scan.data.status?.report_ids ?? [];
    return Promise.all(ids.map((id) => this.#ports.statuses.status(id).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    })));
  }
}
