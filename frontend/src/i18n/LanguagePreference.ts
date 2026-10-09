export const LANGUAGES = ['en', 'hi'] as const;

export type Language = (typeof LANGUAGES)[number];

// Must not throw; BrowserStore wraps localStorage for that.
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'junksnap.language';

export class LanguagePreference {
  readonly #store: KeyValueStore;

  constructor(store: KeyValueStore) {
    this.#store = store;
  }

  load(): Language {
    const saved = this.#store.getItem(STORAGE_KEY);
    return LANGUAGES.find((language) => language === saved) ?? 'en';
  }

  save(language: string): void {
    this.#store.setItem(STORAGE_KEY, language);
  }
}
