import { CaptureError } from '../domain/CaptureError';
import { toHex } from '../domain/utils';

/** SHA-256 of the JPEG bytes as lowercase hex, the contract's sha256. */
export class PhotoHasher {
  readonly #subtle: SubtleCrypto | undefined;

  constructor(subtle: SubtleCrypto | undefined) {
    this.#subtle = subtle;
  }

  async sha256(bytes: ArrayBuffer): Promise<string> {
    if (!this.#subtle) throw new CaptureError('insecure', 'WebCrypto needs HTTPS');
    return toHex(await this.#subtle.digest('SHA-256', bytes));
  }
}
