import type { KeyValueStore } from '../i18n/LanguagePreference';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

// index.html reads the same key before first paint, so the page never flashes the wrong theme.
const STORAGE_KEY = 'junksnap.theme';

/** Light, Dark or System (the default, following prefers-color-scheme), saved per browser. */
export class ThemePreference {
  readonly #store: KeyValueStore;
  readonly #root: HTMLElement | null;
  readonly #listeners = new Set<() => void>();
  #theme: Theme;

  constructor(store: KeyValueStore, root: HTMLElement | null) {
    this.#store = store;
    this.#root = root;
    const saved = store.getItem(STORAGE_KEY);
    this.#theme = THEMES.find((theme) => theme === saved) ?? 'system';
  }

  current(): Theme {
    return this.#theme;
  }

  set(theme: Theme): void {
    this.#theme = theme;
    this.#store.setItem(STORAGE_KEY, theme);
    this.apply();
    this.#listeners.forEach((listener) => listener());
  }

  /** System removes the attribute so the stylesheet's prefers-color-scheme rule decides. */
  apply(): void {
    if (this.#theme === 'system') this.#root?.removeAttribute('data-theme');
    else this.#root?.setAttribute('data-theme', this.#theme);
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
