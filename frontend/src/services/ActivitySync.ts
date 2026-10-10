import { ActivityMerge, type ActivityListing } from '../domain/ActivityMerge';
import { ApiError } from '../domain/ApiError';
import type { ReportStatusView } from '../domain/ReportStatus';
import type { AccountKey } from './AccountKey';
import type { ActivityFreshness } from './ActivityFreshness';
import type { Clock } from './Clock';
import type { DismissedReports } from './DismissedReports';
import type { ReportApi } from './ReportApi';
import type { ReportQueue } from './ReportQueue';

export interface ActivitySyncPorts {
  /** GET /me/reports. */
  readonly api: Pick<ReportApi, 'mine'>;
  readonly queue: Pick<ReportQueue, 'load' | 'snapshot' | 'save' | 'remove'>;
  readonly freshness: ActivityFreshness;
  readonly dismissed: Pick<DismissedReports, 'all'>;
  readonly account: Pick<AccountKey, 'current'>;
  readonly clock: Clock;
}

// 10 pages of 50: a listing longer than that is merged but never used to drop rows.
const MAX_PAGES = 10;

/**
 * Activity shows this phone's rows at once; this brings them in line with the signed-in user's reports
 * on the server when the list token is missing, stale or another account's. Reports still being checked
 * are refreshed one by one by ReportTracker, inside the TTL too.
 */
export class ActivitySync {
  readonly #ports: ActivitySyncPorts;
  #running: Promise<void> | null = null;

  constructor(ports: ActivitySyncPorts) {
    this.#ports = ports;
  }

  /** One sync at a time; offline or refused leaves the phone's copy as it is. */
  revalidate(): Promise<void> {
    this.#running ??= this.#run().finally(() => {
      this.#running = null;
    });
    return this.#running;
  }

  async #run(): Promise<void> {
    const { account, freshness, queue, dismissed, clock } = this.#ports;
    const owner = await account.current();
    if (owner === null) return;
    const token = await freshness.read();
    if (!freshness.isStale(token, owner)) return;
    const listing = await this.#list();
    if (listing === null) return;
    await queue.load();
    const context = { now: clock.now(), ownerChanged: token !== null && token.owner !== owner, dismissed: await dismissed.all() };
    const plan = ActivityMerge.plan(queue.snapshot(), listing, context);
    for (const row of plan.save) await queue.save(row);
    for (const id of plan.remove) await queue.remove(id);
    await freshness.mark(owner, ActivitySync.#newest(listing.views));
  }

  async #list(): Promise<ActivityListing | null> {
    const views: ReportStatusView[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      try {
        const result = await this.#ports.api.mine(cursor);
        views.push(...result.reports);
        cursor = result.next_cursor;
      } catch (error) {
        if (error instanceof ApiError) return null;
        throw error;
      }
      if (cursor === null) return { views, complete: true };
    }
    return { views, complete: false };
  }

  static #newest(views: readonly ReportStatusView[]): string | null {
    return views.reduce<string | null>((newest, view) => (newest === null || view.updated_at > newest ? view.updated_at : newest), null);
  }
}
