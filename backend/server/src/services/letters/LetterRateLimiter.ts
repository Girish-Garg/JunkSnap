import { RateLimitedError } from "../../domain/letters/errors.js";
import type { Requester } from "../../domain/letters/types.js";
import type { LetterCounter } from "../../ports/letters/LetterCounter.js";

const LETTERS_PER_HOUR = 5;
const HOUR_MS = 3_600_000;

export interface LetterCounters {
  readonly devices: LetterCounter;
  readonly users: LetterCounter;
}

export class LetterRateLimiter {
  readonly #counters: LetterCounters;
  readonly #limit: number;

  constructor(counters: LetterCounters, limit: number = LETTERS_PER_HOUR) {
    this.#counters = counters;
    this.#limit = limit;
  }

  // Checks every counter before recording in any, so a refused letter uses up nothing.
  async take(requester: Requester, now: Date): Promise<void> {
    const counted = this.#counted(requester);
    const request = (key: string) => ({ key, now, limit: this.#limit, windowMs: HOUR_MS });
    for (const [counter, key] of counted) {
      if (!(await counter.fits(request(key)))) {
        this.#refuse();
      }
    }
    for (const [counter, key] of counted) {
      if (!(await counter.take(request(key)))) {
        this.#refuse();
      }
    }
  }

  #counted(requester: Requester): (readonly [LetterCounter, string])[] {
    return [
      [this.#counters.devices, requester.deviceToken],
      [this.#counters.users, requester.userId],
    ];
  }

  #refuse(): never {
    throw new RateLimitedError(`At most ${this.#limit} letters an hour. Please try again later.`);
  }
}
