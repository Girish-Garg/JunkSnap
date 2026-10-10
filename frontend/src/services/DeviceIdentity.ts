import { uuidV4 } from '../domain/utils';
import type { MetaStore } from './ReportStore';

const KEY = 'device_token';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The contract's device_token: a random UUID v4 made once per phone and kept in IndexedDB. */
export class DeviceIdentity {
  readonly #store: MetaStore;
  readonly #randomBytes: () => Uint8Array;
  #token: Promise<string> | null = null;

  constructor(store: MetaStore, randomBytes: () => Uint8Array) {
    this.#store = store;
    this.#randomBytes = randomBytes;
  }

  token(): Promise<string> {
    this.#token ??= this.#load().catch((error: unknown) => {
      this.#token = null;
      throw error;
    });
    return this.#token;
  }

  async #load(): Promise<string> {
    const saved = await this.#store.get(KEY);
    if (saved && UUID_V4.test(saved)) return saved;
    const token = uuidV4(this.#randomBytes());
    await this.#store.set(KEY, token);
    return token;
  }
}
