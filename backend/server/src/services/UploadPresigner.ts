import { Sha256Digest } from "../domain/Sha256Digest.js";
import { isoSeconds } from "../domain/timeUtils.js";
import { UploadId, type UploadPurpose } from "../domain/UploadId.js";
import type { Clock } from "../ports/Clock.js";
import type { IdGenerator } from "../ports/IdGenerator.js";
import type { UploadSigner } from "../ports/UploadSigner.js";
import type { SnapLimit } from "./SnapLimit.js";

export interface PresignRequest {
  readonly purpose: UploadPurpose;
  readonly content_type: "image/jpeg";
  readonly sha256: string;
  readonly device_token: string;
}

export interface PresignResponse {
  readonly upload_id: string;
  readonly upload_url: string;
  readonly headers: { readonly "Content-Type": string; readonly "x-amz-checksum-sha256": string };
  readonly expires_at: string;
}

export interface PresignPorts {
  readonly signer: UploadSigner;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly snapLimit: SnapLimit;
}

// A report photo is always a snap now, so presign refuses it once the Snap limit is reached.
export class UploadPresigner {
  readonly #ports: PresignPorts;
  readonly #ttlSeconds: number;

  constructor(ports: PresignPorts, ttlSeconds: number) {
    this.#ports = ports;
    this.#ttlSeconds = ttlSeconds;
  }

  async presign(request: PresignRequest, userId: string): Promise<PresignResponse> {
    const now = this.#ports.clock.now();
    if (request.purpose === "report") {
      await this.#ports.snapLimit.check({ deviceToken: request.device_token, userId }, now);
    }
    const uploadId = UploadId.fromSuffix(this.#ports.ids.next());
    const checksum = Sha256Digest.fromHex(request.sha256).base64();
    const expiresAt = new Date(now.getTime() + this.#ttlSeconds * 1000);
    const uploadUrl = await this.#ports.signer.sign({
      key: uploadId.originalKey(request.purpose),
      contentType: request.content_type,
      checksumBase64: checksum,
      expiresInSeconds: this.#ttlSeconds,
    });
    const headers = { "Content-Type": request.content_type, "x-amz-checksum-sha256": checksum };
    return { upload_id: uploadId.value, upload_url: uploadUrl, headers, expires_at: isoSeconds(expiresAt) };
  }
}
