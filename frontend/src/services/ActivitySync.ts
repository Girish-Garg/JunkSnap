import { ActivityMerge, type ActivityListing } from '../domain/ActivityMerge';
import { ApiError } from '../domain/ApiError';
import type { ReportStatusView } from '../domain/ReportStatus';
import type { AccountKey } from './AccountKey';
import type { ActivityFreshness } from './ActivityFreshness';
import type { AuthService } from './AuthService';
import type { Clock } from './Clock';
import type { DismissedReports } from './DismissedReports';
import type { ReportApi } from './ReportApi';
import type { ReportQueue } from './ReportQueue';
import type { ScanQueue } from './ScanQueue';

export interface ActivitySyncPorts {
  /** GET /me/reports. */
  readonly api: Pick<ReportApi, 'mine'>;
  readonly queue: Pick<ReportQueue, 'load' | 'snapshot' | 'save' | 'remove'>;
  readonly scans: Pick<ScanQueue, 'load' | 'snapshot' | 'remove'>;
  readonly freshness: ActivityFreshness;
  readonly dismissed: Pick<DismissedReports, 'all'>;
  readonly account: Pick<AccountKey, 'current'>;
  readonly clock: Clock;
}

// 10 pages of 50: a listing longer than that is merged but never used to drop rows.
const MAX_PAGES = 10;

/**
 * Activity shows this phone's rows at once; this brings them in line with the signed-in user's reports
 * on the server when the list token is missing, stale or another account's. Sent rows are shown only once
 * the token names the signed-in account (`trusted`), so a shared phone never shows one account's rows to
 * another; signing out removes sent rows. Reports still being checked are refreshed by ReportTracker.
 */
export class ActivitySync {
  readonly #ports: ActivitySyncPorts;
  readonly #listeners = new Set<() => void>();
  #running: Promise<void> | null = null;
  #trusted = false;

  constructor(ports: ActivitySyncPorts) {
    this.#ports = ports;
  }

  /** True once this phone's sent rows are confirmed to be the signed-in account's. */
  trusted(): boolean {
    return this.#trusted;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Follows sign-in changes: another account is untrusted until it syncs, and sign-out removes sent rows. */
  watch(auth: Pick<AuthService, 'subscribe' | 'currentUser'>): () => void {
    let email = auth.currentUser()?.email ?? null;
    return auth.subscribe(() => {
      const next = auth.currentUser()?.email ?? null;
      if (next === email) return;
      email = next;
      this.#setTrusted(false);
      if (next === null) void this.forgetSent();
    });
  }

  /** One sync at a time; offline or refused leaves the phone's copy as it is. */
  revalidate(): Promise<void> {
    this.#running ??= this.#run().finally(() => {
      this.#running = null;
    });
    return this.#running;
  }

  /** Sign-out: sent rows leave this phone (the server keeps them); unsent photos and videos stay. */
  async forgetSent(): Promise<void> {
    const { queue, scans, freshness } = this.#ports;
    await Promise.all([queue.load(), scans.load()]);
    for (const row of queue.snapshot().filter((each) => each.data.stage === 'sent')) await queue.remove(row.id);
    for (const scan of scans.snapshot().filter((each) => each.data.stage === 'sent')) await scans.remove(scan.id);
    await freshness.clear();
  }

  async #run(): Promise<void> {
    const owner = await this.#ports.account.current();
    if (owner === null) return this.#setTrusted(false);
    const token = await this.#ports.freshness.read();
    if (this.#ports.freshness.isStale(token, owner)) await this.#sync(owner, token?.owner ?? null);
    this.#setTrusted((await this.#ports.freshness.read())?.owner === owner);
  }

  async #sync(owner: string, previous: string | null): Promise<void> {
    const { freshness, queue, dismissed, clock } = this.#ports;
    const listing = await this.#list();
    if (listing === null) return;
    await queue.load();
    const context = { now: clock.now(), ownerChanged: previous !== null && previous !== owner, dismissed: await dismissed.all() };
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

  #setTrusted(trusted: boolean): void {
    if (trusted === this.#trusted) return;
    this.#trusted = trusted;
    for (const listener of this.#listeners) listener();
  }

  static #newest(views: readonly ReportStatusView[]): string | null {
    return views.reduce<string | null>((newest, view) => (newest === null || view.updated_at > newest ? view.updated_at : newest), null);
  }
}
