import type { Clock } from './Clock';
import type { MetaStore } from './ReportStore';

const KEY = 'activity.token';
export const ACTIVITY_TTL_MS = 60_000;

/** The list-level token: whose list this phone holds, when it was last synced, and the newest updated_at seen. */
export interface ActivityToken {
  readonly owner: string;
  readonly synced_at: string;
  readonly newest: string | null;
}

/**
 * When Activity must ask the server again: no token, a token older than the TTL, or another account's.
 * Kept behind this small interface so it can move onto the shared expiring-cache primitive later.
 */
export class ActivityFreshness {
  readonly #store: MetaStore;
  readonly #clock: Clock;
  readonly #ttlMs: number;

  constructor(store: MetaStore, clock: Clock, ttlMs = ACTIVITY_TTL_MS) {
    this.#store = store;
    this.#clock = clock;
    this.#ttlMs = ttlMs;
  }

  async read(): Promise<ActivityToken | null> {
    const raw = await this.#store.get(KEY);
    if (!raw) return null;
    try {
      const token = JSON.parse(raw) as Partial<ActivityToken>;
      return typeof token.owner === 'string' && typeof token.synced_at === 'string' ? (token as ActivityToken) : null;
    } catch {
      return null;
    }
  }

  isStale(token: ActivityToken | null, owner: string): boolean {
    if (token === null || token.owner !== owner) return true;
    return this.#clock.now().getTime() - Date.parse(token.synced_at) >= this.#ttlMs;
  }

  async mark(owner: string, newest: string | null): Promise<void> {
    const token: ActivityToken = { owner, synced_at: this.#clock.now().toISOString(), newest };
    await this.#store.set(KEY, JSON.stringify(token));
  }
}
