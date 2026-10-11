/**
 * A mark in web storage. In session storage it lasts one browser session: one tab in a browser, one launch of the
 * Android app (its WebView starts with empty session storage). In local storage it lasts until cleared. Storage that
 * throws (private mode, blocked) holds no mark, so whoever reads it acts as if it were never set.
 */
export class StoredFlag {
  readonly #key: string;
  readonly #storage: () => Storage;

  constructor(key: string, storage: () => Storage) {
    this.#key = key;
    this.#storage = storage;
  }

  isSet(): boolean {
    try {
      return this.#storage().getItem(this.#key) !== null;
    } catch {
      return false;
    }
  }

  set(): void {
    this.#write((storage) => storage.setItem(this.#key, 'set'));
  }

  clear(): void {
    this.#write((storage) => storage.removeItem(this.#key));
  }

  #write(change: (storage: Storage) => void): void {
    try {
      change(this.#storage());
    } catch {
      // Without storage there is no mark to keep.
    }
  }
}
