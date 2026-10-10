import type { MetaStore } from './ReportStore';

const KEY = 'activity.dismissed';
// Enough for years of one person's reports; the oldest fall off first.
const MAX_IDS = 500;

/** Report ids deleted from Activity on this phone, so a server listing never brings their rows back. */
export class DismissedReports {
  readonly #store: MetaStore;

  constructor(store: MetaStore) {
    this.#store = store;
  }

  async all(): Promise<ReadonlySet<string>> {
    return new Set(await this.#ids());
  }

  async add(reportId: string): Promise<void> {
    const ids = (await this.#ids()).filter((id) => id !== reportId);
    await this.#store.set(KEY, JSON.stringify([...ids, reportId].slice(-MAX_IDS)));
  }

  async #ids(): Promise<string[]> {
    try {
      const parsed: unknown = JSON.parse((await this.#store.get(KEY)) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }
}
