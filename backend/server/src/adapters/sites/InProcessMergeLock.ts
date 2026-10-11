import type { MergeLock } from "../../ports/sites/MergeLock.js";

type Release = () => void;

// One first-come queue per key, in this process only (one worker replica; contracts/README.md). Keys are taken one at a
// time in sorted order, so two holders never wait on each other in a cycle, and holders with no key in common run side
// by side. A holder's body is bounded by the AWS client timeouts, so a waiter is never blocked for good.
export class InProcessMergeLock implements MergeLock {
  readonly #tails = new Map<string, Promise<void>>();

  async hold<T>(keys: readonly string[], body: () => Promise<T>): Promise<T> {
    const releases: Release[] = [];
    try {
      for (const key of [...new Set(keys)].sort()) {
        releases.push(await this.#take(key));
      }
      return await body();
    } finally {
      releases.reverse().forEach((release) => release());
    }
  }

  // Resolves once every earlier holder of the key has released it; the queue entry goes when its last holder leaves.
  async #take(key: string): Promise<Release> {
    const before = this.#tails.get(key) ?? Promise.resolve();
    let release: Release = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = before.then(() => held);
    this.#tails.set(key, tail);
    await before;
    return () => {
      release();
      if (this.#tails.get(key) === tail) {
        this.#tails.delete(key);
      }
    };
  }
}
