import { ActivityMerge, type ActivityListing } from '../domain/ActivityMerge';
import { ApiError } from '../domain/ApiError';
import { AuthError } from '../domain/AuthError';
import type { ReportStatusView } from '../domain/ReportStatus';
import type { AccountKey } from './AccountKey';
import type { ActivityFreshness } from './ActivityFreshness';
import type { ActivityOwnership } from './ActivityOwnership';
import type { AuthService } from './AuthService';
import type { Clock } from './Clock';
import type { DismissedReports } from './DismissedReports';
import type { ReportApi } from './ReportApi';
import type { ReportQueue } from './ReportQueue';

export interface ActivitySyncPorts {
  /** GET /me/reports. */
  readonly api: Pick<ReportApi, 'mine'>;
  readonly queue: Pick<ReportQueue, 'load' | 'snapshot' | 'save' | 'remove'>;
  readonly freshness: ActivityFreshness;
  /** Who the phone's sent rows belong to, kept on disk across restarts. */
  readonly ownership: Pick<ActivityOwnership, 'claim' | 'forget' | 'since' | 'dropSentBefore'>;
  readonly dismissed: Pick<DismissedReports, 'all'>;
  readonly account: Pick<AccountKey, 'current'>;
  readonly clock: Clock;
}

// 10 pages of 50: a listing longer than that is merged but never used to drop rows.
const MAX_PAGES = 10;

export interface ActivityState {
  /** This phone's sent rows are confirmed to be the signed-in account's. */
  readonly trusted: boolean;
  /** No sync has finished since start or the last sign-in change, so an empty list may not be empty yet. */
  readonly loading: boolean;
}

interface Run {
  readonly generation: number;
  readonly done: Promise<void>;
}

/**
 * Activity shows this phone's rows at once; this brings them in line with the signed-in user's reports
 * on the server when the list token is missing, stale or another account's. Sent rows are shown only once
 * the token names the signed-in account (`trusted`), so a shared phone never shows one account's rows to
 * another. Sign-in claims the phone for the account on disk (ActivityOwnership), so a restart never mistakes
 * the account's own rows for another's. If the token is still missing or foreign, sent photos and videos saved
 * before the claim are removed. Reports still being checked are refreshed by ReportTracker.
 */
export class ActivitySync {
  readonly #ports: ActivitySyncPorts;
  readonly #listeners = new Set<() => void>();
  #running: Run | null = null;
  #state: ActivityState = { trusted: false, loading: true };
  /** Bumped at every sign-in change; a sync started before it drops what it brought back. */
  #generation = 0;
  /** The claim or forget that sign-in or sign-out started; a sync waits for it. */
  #owning: Promise<void> = Promise.resolve();

  constructor(ports: ActivitySyncPorts) {
    this.#ports = ports;
  }

  /** True once this phone's sent rows are confirmed to be the signed-in account's. */
  trusted(): boolean {
    return this.#state.trusted;
  }

  /** The same object until something changes, for useSyncExternalStore. */
  state(): ActivityState {
    return this.#state;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Follows sign-in changes: a signed-in account claims the phone (also at start, for a restored session),
   * another account is untrusted until it syncs, and sign-out removes sent rows.
   */
  watch(auth: Pick<AuthService, 'subscribe' | 'currentUser'>): () => void {
    let email = auth.currentUser()?.email ?? null;
    if (email !== null) this.#own(() => this.#ports.ownership.claim(false));
    return auth.subscribe(() => {
      const next = auth.currentUser()?.email ?? null;
      if (next === email) return;
      email = next;
      this.#generation += 1;
      this.#setState({ trusted: false, loading: true });
      this.#own(() => (next === null ? this.#ports.ownership.forget() : this.#ports.ownership.claim(true)));
    });
  }

  /** Resolves once the claim at sign-in or the clean-up at sign-out has finished. */
  settled(): Promise<void> {
    return this.#owning;
  }

  /** One sync at a time per sign-in; offline or refused leaves the phone's copy as it is. */
  revalidate(): Promise<void> {
    const generation = this.#generation;
    if (this.#running?.generation === generation) return this.#running.done;
    const done: Promise<void> = this.#run(generation).finally(() => {
      if (this.#running?.done === done) this.#running = null;
    });
    this.#running = { generation, done };
    return done;
  }

  // A claim or clean-up waits for a sync in flight, so it never interleaves with that sync's writes.
  #own(step: () => Promise<void>): void {
    const running = this.#running?.done.catch(() => undefined);
    this.#owning = this.#owning.then(() => running).then(step).catch(() => undefined);
  }

  async #run(generation: number): Promise<void> {
    let trusted: boolean | null = null;
    try {
      trusted = await this.#check(generation);
    } finally {
      if (generation === this.#generation) this.#setState({ trusted: trusted ?? this.#state.trusted, loading: false });
    }
  }

  /** Whether the sent rows are the signed-in account's; a token that names it and is still fresh is trusted at once. */
  async #check(generation: number): Promise<boolean> {
    await this.#owning;
    const owner = await this.#ports.account.current();
    if (owner === null) return false;
    const token = await this.#ports.freshness.read();
    if (!this.#ports.freshness.isStale(token, owner)) return true;
    await this.#sync(owner, token?.owner !== owner, generation);
    return (await this.#ports.freshness.read())?.owner === owner;
  }

  /** ownerChanged: the token was missing or another account's. */
  async #sync(owner: string, ownerChanged: boolean, generation: number): Promise<void> {
    const { freshness, queue, dismissed, clock } = this.#ports;
    const listing = await this.#list();
    if (listing === null) return;
    await queue.load();
    const ownedSince = await this.#ports.ownership.since();
    const context = { now: clock.now(), ownerChanged, ownedSince, dismissed: await dismissed.all() };
    // The sign-in changed while the list was on its way: it is the previous account's, so nothing of it lands.
    if (generation !== this.#generation) return;
    const plan = ActivityMerge.plan(queue.snapshot(), listing, context);
    for (const row of plan.save) await queue.save(row);
    for (const id of plan.remove) await queue.remove(id);
    if (ownerChanged) await this.#ports.ownership.dropSentBefore(ownedSince);
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
        // Offline, refused, or a sign-in that cannot be refreshed: the phone's copy stays.
        if (error instanceof ApiError || error instanceof AuthError) return null;
        throw error;
      }
      if (cursor === null) return { views, complete: true };
    }
    return { views, complete: false };
  }

  #setState(next: ActivityState): void {
    if (next.trusted === this.#state.trusted && next.loading === this.#state.loading) return;
    this.#state = next;
    for (const listener of this.#listeners) listener();
  }

  static #newest(views: readonly ReportStatusView[]): string | null {
    return views.reduce<string | null>((newest, view) => (newest === null || view.updated_at > newest ? view.updated_at : newest), null);
  }
}
