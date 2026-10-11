import { RateLimitedError } from "../../domain/letters/errors.js";
import type { Requester } from "../../domain/letters/types.js";
import type { LetterCounter } from "../../ports/letters/LetterCounter.js";
import type { Logger } from "../../ports/Logger.js";

const HOUR_MS = 3_600_000;

export interface LetterCounters {
  readonly devices: LetterCounter;
  readonly users: LetterCounter;
}

export class LetterRateLimiter {
  readonly #counters: LetterCounters;
  readonly #limit: number;
  readonly #noun: string;
  readonly #logger: Logger;

  // limit: this action's per-hour setting (LETTERS_PER_HOUR, CONFIRMATIONS_PER_HOUR, ...).
  constructor(counters: LetterCounters, logger: Logger, limit: number, noun = "letters") {
    this.#counters = counters;
    this.#logger = logger;
    this.#limit = limit;
    this.#noun = noun;
  }

  // Reads only: refuses early, before any costly work, when a counter is already full.
  async fits(requester: Requester, now: Date): Promise<void> {
    for (const [counter, key] of this.#counted(requester)) {
      if (!(await counter.fits(this.#request(key, now)))) {
        this.#refuse();
      }
    }
  }

  // All counters or none: a counter that fills or fails meanwhile gives back the ones already taken, so a refusal uses up nothing.
  async take(requester: Requester, now: Date): Promise<void> {
    await this.fits(requester, now);
    const taken: (readonly [LetterCounter, string])[] = [];
    try {
      for (const [counter, key] of this.#counted(requester)) {
        if (!(await counter.take(this.#request(key, now)))) {
          this.#refuse();
        }
        taken.push([counter, key]);
      }
    } catch (error) {
      await this.#giveBack(taken, now);
      throw error;
    }
  }

  // A slot that cannot be given back stays spent until its window ends; the caller still gets the original error.
  async #giveBack(taken: readonly (readonly [LetterCounter, string])[], now: Date): Promise<void> {
    const results = await Promise.allSettled(taken.map(([counter, key]) => counter.release(this.#request(key, now))));
    for (const result of results) {
      if (result.status === "rejected") {
        this.#logger.warn({ error: result.reason, limit: this.#noun }, "could not give back a rate-limit slot");
      }
    }
  }

  #request(key: string, now: Date) {
    return { key, now, limit: this.#limit, windowMs: HOUR_MS };
  }

  #counted(requester: Requester): (readonly [LetterCounter, string])[] {
    return [
      [this.#counters.devices, requester.deviceToken],
      [this.#counters.users, requester.userId],
    ];
  }

  #refuse(): never {
    throw new RateLimitedError(`At most ${this.#limit} ${this.#noun} an hour. Please try again later.`);
  }
}
