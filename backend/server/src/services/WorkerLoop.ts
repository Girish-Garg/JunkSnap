import type { Logger } from "../ports/Logger.js";
import type { QueuePoller } from "../ports/QueuePoller.js";

// A failed poll ends run() so the pod restarts; per-message retries belong to SQS.
export class WorkerLoop {
  readonly #poller: QueuePoller;
  readonly #logger: Logger;
  readonly #stopper = new AbortController();

  constructor(poller: QueuePoller, logger: Logger) {
    this.#poller = poller;
    this.#logger = logger;
  }

  async run(): Promise<void> {
    const signal = this.#stopper.signal;
    while (!signal.aborted) {
      await this.#poller.pollOnce(signal);
    }
  }

  stop(reason: string): void {
    if (this.#stopper.signal.aborted) {
      return;
    }
    this.#logger.info({ reason }, "worker stopping");
    this.#stopper.abort(reason);
  }
}
