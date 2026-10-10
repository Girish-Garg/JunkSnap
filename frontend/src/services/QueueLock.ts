const LOCK_NAME = 'junksnap-report-queue';

/** One tab sends at a time (Web Locks), so two open tabs never send one photo twice. */
export class QueueLock {
  readonly #locks: LockManager | undefined;

  constructor(locks: LockManager | undefined) {
    this.#locks = locks;
  }

  async run(task: () => Promise<void>): Promise<void> {
    if (!this.#locks) return task();
    await this.#locks.request(LOCK_NAME, task);
  }
}
