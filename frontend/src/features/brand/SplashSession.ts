const KEY = 'junksnap.splash';

/** The splash plays once per browser session; storage that throws (private mode, blocked) just means "play". */
export class SplashSession {
  readonly #storage: () => Storage;

  constructor(storage: () => Storage) {
    this.#storage = storage;
  }

  due(): boolean {
    try {
      return this.#storage().getItem(KEY) === null;
    } catch {
      return true;
    }
  }

  played(): void {
    try {
      this.#storage().setItem(KEY, 'played');
    } catch {
      // Without storage the splash simply plays again next load.
    }
  }
}
