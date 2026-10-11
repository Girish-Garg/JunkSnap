import { UI_DEFAULTS } from '../config/UiTimings';
import type { Timer } from './Timer';

/** Remembers which action groups the api rate-limited, so their buttons say why instead of trying again at once. */
export class ActionCooldowns {
  readonly #timer: Timer;
  readonly #now: () => number;
  readonly #holdMs: number;
  readonly #until = new Map<string, number>();
  readonly #listeners = new Set<() => void>();
  #active: ReadonlySet<string> = new Set();

  /** holdMs: how long an action stays off after a 429 (ui.cooldownMs); the api's windows are an hour, so a retry may 429 again. */
  constructor(timer: Timer, now: () => number, holdMs: number = UI_DEFAULTS.cooldownMs) {
    this.#timer = timer;
    this.#now = now;
    this.#holdMs = holdMs;
  }

  hold(group: string, ms: number = this.#holdMs): void {
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
