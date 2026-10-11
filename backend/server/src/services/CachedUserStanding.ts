import type { Clock } from "../ports/Clock.js";
import type { UserStanding } from "../ports/UserStanding.js";

// Bounds memory: past this many users the oldest entry goes first.
const MAX_ENTRIES = 10_000;

interface Entry {
  readonly blocked: boolean;
  readonly expiresAt: number;
}

// Keeps each answer for ttlMs, so a signed-in user costs at most one GetItem per window; a block takes effect within it.
export class CachedUserStanding implements UserStanding {
  readonly #inner: UserStanding;
  readonly #clock: Clock;
  readonly #ttlMs: number;
  readonly #entries = new Map<string, Entry>();

  constructor(inner: UserStanding, clock: Clock, ttlMs: number) {
    this.#inner = inner;
    this.#clock = clock;
    this.#ttlMs = ttlMs;
  }

  async isBlocked(userId: string): Promise<boolean> {
    const now = this.#clock.now().getTime();
    const cached = this.#entries.get(userId);
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.blocked;
    }
    const blocked = await this.#inner.isBlocked(userId);
    this.#remember(userId, { blocked, expiresAt: now + this.#ttlMs });
    return blocked;
  }

  #remember(userId: string, entry: Entry): void {
    this.#entries.delete(userId);
    if (this.#entries.size >= MAX_ENTRIES) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) {
        this.#entries.delete(oldest);
      }
    }
    this.#entries.set(userId, entry);
  }
}
