import { setTimeout as sleep } from "node:timers/promises";
import type { QueuePoller } from "../ports/QueuePoller.js";

// Stand-in until the SQS poller lands: waits one long-poll interval and handles nothing.
export class IdleQueuePoller implements QueuePoller {
  readonly #waitMs: number;

  constructor(waitMs: number) {
    this.#waitMs = waitMs;
  }

  async pollOnce(signal: AbortSignal): Promise<void> {
    try {
      await sleep(this.#waitMs, undefined, { signal });
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  }
}
