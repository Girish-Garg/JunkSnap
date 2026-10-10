/** One tab sends a queue at a time (Web Locks), so two open tabs never send one capture twice. */
export class QueueLock {
  readonly #locks: LockManager | undefined;
  readonly #name: string;

  constructor(locks: LockManager | undefined, name = 'junksnap-report-queue') {
    this.#locks = locks;
    this.#name = name;
  }

  async run(task: () => Promise<void>): Promise<void> {
    if (!this.#locks) return task();
    await this.#locks.request(this.#name, task);
  }
}
