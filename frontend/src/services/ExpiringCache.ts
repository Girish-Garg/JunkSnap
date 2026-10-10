import type { Clock } from './Clock';

/** A value and its freshness token: a server ETag, a version or a content hash; null when there is none. */
export interface Tagged<T> {
  readonly value: T;
  readonly token: string | null;
}

/** One read: the value, whether it is past its TTL, and why the last refresh failed (null when it did not). */
export interface CacheRead<T> {
  readonly value: T;
  readonly stale: boolean;
  readonly error: unknown;
}

/** Fetches the value; `previous` is the copy in hand, so the loader can ask the server whether it changed. */
export type CacheLoader<T> = (previous: Tagged<T> | null) => Promise<Tagged<T>>;

export interface CacheRequest<T> {
  readonly key: string;
  readonly load: CacheLoader<T>;
  /** The token the copy must carry, when the caller knows the current one; a mismatch is never served. */
  readonly token?: string | null;
}

export interface CachePolicy {
  readonly ttlMs: number;
  /** True serves a copy past its TTL at once and refreshes it in the background; false waits for the refresh. */
  readonly staleWhileRevalidate: boolean;
  /** The oldest entries go first beyond this many keys. */
  readonly maxEntries: number;
}

interface Entry<T> extends Tagged<T> {
  readonly fetchedAt: number;
  readonly error: unknown;
}

/**
 * Keeps values with their freshness token and fetch time. A fresh copy comes back at once; an old one is refreshed
 * (in the background or before answering, per policy); a failed refresh keeps the old copy and flags the error.
 */
export class ExpiringCache<T> {
  readonly #policy: CachePolicy;
  readonly #clock: Clock;
  readonly #entries = new Map<string, Entry<T>>();
  readonly #inflight = new Map<string, Promise<Entry<T>>>();

  constructor(policy: CachePolicy, clock: Clock) {
    this.#policy = policy;
    this.#clock = clock;
  }

  async get(request: CacheRequest<T>): Promise<T> {
    return (await this.read(request)).value;
  }

  async read(request: CacheRequest<T>): Promise<CacheRead<T>> {
    const entry = this.#usable(request);
    if (entry && this.#fresh(entry)) return { value: entry.value, stale: false, error: entry.error };
    if (entry && this.#policy.staleWhileRevalidate) {
      this.#refresh(request, entry).catch(() => undefined);
      return { value: entry.value, stale: true, error: entry.error };
    }
    try {
      const next = await this.#refresh(request, entry);
      return { value: next.value, stale: false, error: null };
    } catch (error) {
      if (!entry) throw error;
      return { value: entry.value, stale: true, error };
    }
  }

  /** Drops one key, so the next read fetches it again. */
  forget(key: string): void {
    this.#entries.delete(key);
  }

  #usable({ key, token }: CacheRequest<T>): Entry<T> | null {
    const entry = this.#entries.get(key);
    if (!entry || (token !== undefined && entry.token !== token)) return null;
    return entry;
  }

  #fresh(entry: Entry<T>): boolean {
    return this.#clock.now().getTime() - entry.fetchedAt < this.#policy.ttlMs;
  }

  // One request per key at a time; every caller waiting on the same key shares it.
  #refresh(request: CacheRequest<T>, previous: Entry<T> | null): Promise<Entry<T>> {
    const running = this.#inflight.get(request.key);
    if (running) return running;
    const next = this.#load(request, previous).finally(() => this.#inflight.delete(request.key));
    this.#inflight.set(request.key, next);
    return next;
  }

  async #load({ key, load }: CacheRequest<T>, previous: Entry<T> | null): Promise<Entry<T>> {
    try {
      const fetched = await load(previous && { value: previous.value, token: previous.token });
      return this.#store(key, { ...fetched, fetchedAt: this.#clock.now().getTime(), error: null });
    } catch (error) {
      if (previous) this.#entries.set(key, { ...previous, error });
      throw error;
    }
  }

  #store(key: string, entry: Entry<T>): Entry<T> {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    for (const oldest of this.#entries.keys()) {
      if (this.#entries.size <= this.#policy.maxEntries) break;
      this.#entries.delete(oldest);
    }
    return entry;
  }
}
