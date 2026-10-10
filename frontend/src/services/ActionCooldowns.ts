import type { Timer } from './Timer';

/** How long an action stays off after a 429; the api's windows are an hour, so a retry after this may 429 again. */
export const COOLDOWN_MS = 60_000;

/** Remembers which action groups the api rate-limited, so their buttons say why instead of trying again at once. */
export class ActionCooldowns {
  readonly #timer: Timer;
  readonly #now: () => number;
  readonly #until = new Map<string, number>();
  readonly #listeners = new Set<() => void>();
  #active: ReadonlySet<string> = new Set();

  constructor(timer: Timer, now: () => number) {
    this.#timer = timer;
    this.#now = now;
  }

  hold(group: string, ms: number = COOLDOWN_MS): void {
    this.#until.set(group, this.#now() + ms);
    this.#timer.set(() => this.#refresh(), ms);
    this.#refresh();
  }

  /** The groups still cooling down; the same set object until something changes, for useSyncExternalStore. */
  active(): ReadonlySet<string> {
    return this.#active;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #refresh(): void {
    const now = this.#now();
    const active = new Set([...this.#until].filter(([, until]) => until > now).map(([group]) => group));
    if (active.size === this.#active.size && [...active].every((group) => this.#active.has(group))) return;
    this.#active = active;
    for (const listener of this.#listeners) listener();
  }
}
