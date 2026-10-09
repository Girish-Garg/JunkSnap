import type { KeyValueStore } from '../i18n/LanguagePreference';

/** localStorage that falls back to memory when the browser blocks storage. */
export class BrowserStore implements KeyValueStore {
  readonly #open: () => Storage;
  readonly #memory = new Map<string, string>();

  constructor(open: () => Storage) {
    this.#open = open;
  }

  getItem(key: string): string | null {
    try {
      return this.#open().getItem(key);
    } catch {
      return this.#memory.get(key) ?? null;
    }
  }

  setItem(key: string, value: string): void {
    this.#memory.set(key, value);
    try {
      this.#open().setItem(key, value);
    } catch {
      // Blocked storage: the memory copy lasts for this visit.
    }
  }
}
