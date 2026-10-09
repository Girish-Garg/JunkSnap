import { createHash } from "node:crypto";
import { InvalidImageError } from "../../domain/moderation/errors.js";
import type { LoadedPhoto } from "../../domain/moderation/LoadedPhoto.js";
import { PerceptualHash } from "../../domain/moderation/PerceptualHash.js";
import type { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";
import type { ImageCodec } from "../../ports/moderation/ImageCodec.js";
import type { ImageStore } from "../../ports/moderation/ImageStore.js";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
// Rekognition's 5 MB image limit, read as decimal to be safe; its boxes are fractions, so they fit the original too.
const MAX_DETECTOR_BYTES = 5_000_000;
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

// Either a usable photo, or the short cause that makes it invalid_image.
export type PhotoLoad = { readonly photo: LoadedPhoto } | { readonly invalid: string };

export class PhotoLoader {
  readonly #store: ImageStore;
  readonly #codec: ImageCodec;

  constructor(store: ImageStore, codec: ImageCodec) {
    this.#store = store;
    this.#codec = codec;
  }

  async load(submission: PhotoSubmission): Promise<PhotoLoad> {
    const original = await this.#store.readOriginal(submission.photoId.privateOriginalKey(), MAX_UPLOAD_BYTES);
    if (original === null) {
      return { invalid: "over_8_mb" };
    }
    if (!JPEG_MAGIC.every((byte, index) => original[index] === byte)) {
      return { invalid: "not_jpeg" };
    }
    if (createHash("sha256").update(original).digest("hex") !== submission.fields.sha256) {
      return { invalid: "sha256_mismatch" };
    }
    try {
      return await this.#decode(original);
    } catch (error) {
      if (error instanceof InvalidImageError) {
        return { invalid: "undecodable" };
      }
      throw error;
    }
  }

  async #decode(original: Uint8Array): Promise<PhotoLoad> {
    const facts = await this.#codec.describe(original);
    if (facts.format !== "jpeg") {
      return { invalid: "not_jpeg" };
    }
    const hash = PerceptualHash.fromGrayscale(await this.#codec.grayscale(original, PerceptualHash.SIDE));
    const detectorCopy =
      original.byteLength > MAX_DETECTOR_BYTES ? await this.#codec.shrinkBelow(original, MAX_DETECTOR_BYTES) : original;
    return { photo: { original, detectorCopy, hash } };
  }
}
