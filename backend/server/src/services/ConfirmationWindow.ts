import type { AskedWindow } from "../domain/ReportConfirmation.js";
import { isoSeconds } from "../domain/timeUtils.js";
import type { Clock } from "../ports/Clock.js";

const HOUR_MS = 3_600_000;

// How long a reporter has to answer an unsure judge: CONFIRM_TTL_HOURS from the moment the verify step asked.
export class ConfirmationWindow {
  readonly #clock: Clock;
  readonly #hours: number;

  constructor(clock: Clock, hours: number) {
    this.#clock = clock;
    this.#hours = hours;
  }

  open(): AskedWindow {
    const now = this.#clock.now();
    const expires = new Date(now.getTime() + this.#hours * HOUR_MS);
    return { askedAt: isoSeconds(now), expiresAt: isoSeconds(expires) };
  }
}
