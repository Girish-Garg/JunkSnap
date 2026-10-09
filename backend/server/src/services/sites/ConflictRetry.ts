import { StaleSiteError } from "../../domain/sites/SiteErrors.js";

const DEFAULT_ATTEMPTS = 3;

// Re-runs a whole read-modify-write when another writer saved the site first.
export class ConflictRetry {
  readonly #attempts: number;

  constructor(attempts: number = DEFAULT_ATTEMPTS) {
    this.#attempts = attempts;
  }

  async run<T>(attempt: () => Promise<T>): Promise<T> {
    for (let left = this.#attempts; ; left -= 1) {
      try {
        return await attempt();
      } catch (error) {
        if (!(error instanceof StaleSiteError) || left <= 1) {
          throw error;
        }
      }
    }
  }
}
