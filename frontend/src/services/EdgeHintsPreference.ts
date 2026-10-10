import type { KeyValueStore } from '../i18n/LanguagePreference';

const STORAGE_KEY = 'junksnap.edgeHints';
const OFF = 'off';

/** Settings → On-device hints: on unless the person turned it off on this browser. */
export class EdgeHintsPreference {
  readonly #store: KeyValueStore;
  readonly #listeners = new Set<() => void>();

  constructor(store: KeyValueStore) {
    this.#store = store;
  }

  on(): boolean {
    return this.#store.getItem(STORAGE_KEY) !== OFF;
  }

  set(on: boolean): void {
    this.#store.setItem(STORAGE_KEY, on ? 'on' : OFF);
    this.#listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
