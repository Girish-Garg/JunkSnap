import { ScanTooLargeError } from "../domain/scanErrors.js";
import type { ScanVideoLimits } from "../domain/scanLimits.js";
import type { ScanUploadSigner } from "../ports/ScanUploadSigner.js";

const EXTENSIONS = { "video/webm": "webm", "video/mp4": "mp4" } as const;
const MS_PER_SECOND = 1_000;

export interface ScanPresignRequest {
  readonly content_type: keyof typeof EXTENSIONS;
  readonly sha256: string;
  readonly size_bytes: number;
  readonly duration_ms: number;
  readonly device_token: string;
}

export interface ScanPresignResponse {
  readonly scan_id: string;
  readonly upload_url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expires_at: string;
}

export interface PresignOptions {
  readonly ttlSeconds: number;
  readonly now: () => Date;
  readonly newScanId: () => string;
  readonly limits: Pick<ScanVideoLimits, "maxBytes" | "maxDurationMs">;
}

export class ScanUploadPresigner {
  readonly #signer: ScanUploadSigner;
  readonly #options: PresignOptions;

  constructor(signer: ScanUploadSigner, options: PresignOptions) {
    this.#signer = signer;
    this.#options = options;
  }

  async presign(request: ScanPresignRequest): Promise<ScanPresignResponse> {
    this.#checkLimit(request);
    const scanId = this.#options.newScanId();
    const key = `scans/${scanId}.${EXTENSIONS[request.content_type]}`;
    const upload = { key, contentType: request.content_type, sha256Hex: request.sha256, sizeBytes: request.size_bytes };
    const signed = await this.#signer.sign(upload);
    const expiresAt = new Date(this.#options.now().getTime() + this.#options.ttlSeconds * MS_PER_SECOND);
    return { scan_id: scanId, upload_url: signed.url, headers: signed.headers, expires_at: expiresAt.toISOString() };
  }

  #checkLimit({ size_bytes, duration_ms }: ScanPresignRequest): void {
    const { maxBytes, maxDurationMs } = this.#options.limits;
    if (size_bytes > maxBytes) {
      throw new ScanTooLargeError(`size_bytes is over the scan video limit of ${maxBytes}`);
    }
    if (duration_ms > maxDurationMs) {
      throw new ScanTooLargeError(`duration_ms is over the scan video limit of ${maxDurationMs}`);
    }
  }
}
