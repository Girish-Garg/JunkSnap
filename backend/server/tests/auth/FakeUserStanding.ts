import type { UserStanding } from "../../src/ports/UserStanding.js";

// Blocks only the listed user ids, as if every other user had no users row; records each read.
export class FakeUserStanding implements UserStanding {
  readonly reads: string[] = [];
  readonly #blocked: ReadonlySet<string>;

  constructor(blocked: readonly string[] = []) {
    this.#blocked = new Set(blocked);
  }

  async isBlocked(userId: string): Promise<boolean> {
    this.reads.push(userId);
    return this.#blocked.has(userId);
  }
}
