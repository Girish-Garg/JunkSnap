import type { AccountKey } from './AccountKey';
import type { ActivityFreshness } from './ActivityFreshness';
import type { Clock } from './Clock';
import type { ReportQueue } from './ReportQueue';
import type { MetaStore } from './ReportStore';
import type { ScanQueue } from './ScanQueue';

const SINCE_KEY = 'activity.since';

export interface ActivityOwnershipPorts {
  readonly queue: Pick<ReportQueue, 'load' | 'snapshot' | 'remove'>;
  readonly scans: Pick<ScanQueue, 'load' | 'snapshot' | 'remove'>;
  readonly freshness: Pick<ActivityFreshness, 'read' | 'claim' | 'clear'>;
  readonly account: Pick<AccountKey, 'current'>;
  readonly meta: MetaStore;
  readonly clock: Clock;
}

/**
 * Whose sent photos and videos this phone holds, kept on disk so it survives restarts. At sign-in (and at
 * start, for a session restored from before this release) the account claims the phone: sent rows saved
 * before that moment belong to whoever was here before and go, and the list token names the new account.
 * Sign-out removes sent rows and the claim. Unsent rows always stay.
 */
export class ActivityOwnership {
  readonly #ports: ActivityOwnershipPorts;

  constructor(ports: ActivityOwnershipPorts) {
    this.#ports = ports;
  }

  /** fresh: a sign-in just happened, so it starts now; otherwise a stored start is kept. */
  async claim(fresh: boolean): Promise<void> {
    const since = fresh ? null : await this.#stored();
    const start = since ?? this.#ports.clock.now().getTime();
    await this.#ports.meta.set(SINCE_KEY, String(start));
    const owner = await this.#ports.account.current();
    if (owner === null || (await this.#ports.freshness.read())?.owner === owner) return;
    await this.dropSentBefore(start);
    await this.#ports.freshness.claim(owner);
  }

  /** Sign-out: sent rows leave this phone (the server keeps them), with the token and the claim. */
  async forget(): Promise<void> {
    await this.dropSentBefore(Number.POSITIVE_INFINITY);
    await this.#ports.freshness.clear();
    await this.#ports.meta.set(SINCE_KEY, '');
  }

  /** When the current account's time on this phone began (ms); rows saved since then are its own. */
  async since(): Promise<number> {
    return (await this.#stored()) ?? this.#ports.clock.now().getTime();
  }

  async dropSentBefore(limit: number): Promise<void> {
    const { queue, scans } = this.#ports;
    await Promise.all([queue.load(), scans.load()]);
    const before = (item: { readonly data: { readonly stage: string; readonly saved_at: string } }) => item.data.stage === 'sent' && Date.parse(item.data.saved_at) < limit;
    for (const row of queue.snapshot().filter(before)) await queue.remove(row.id);
    for (const scan of scans.snapshot().filter(before)) await scans.remove(scan.id);
  }

  async #stored(): Promise<number | null> {
    const value = Number(await this.#ports.meta.get(SINCE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
}
