import sharp from "sharp";
import { InvalidImageError } from "../../domain/moderation/errors.js";
import type { ImageCodec, ImageFacts } from "../../ports/moderation/ImageCodec.js";

// Long edges tried in turn when a photo is too big for Rekognition.
const SHRINK_EDGES = [3072, 2048, 1024];
const SHRINK_QUALITY = 85;

export class SharpImageCodec implements ImageCodec {
  async describe(bytes: Uint8Array): Promise<ImageFacts> {
    const meta = await this.#decoding(() => sharp(bytes).metadata());
    return { format: meta.format, width: meta.width, height: meta.height };
  }

  async grayscale(bytes: Uint8Array, side: number): Promise<Uint8Array> {
    const pixels = await this.#decoding(() =>
      sharp(bytes).autoOrient().grayscale().resize(side, side, { fit: "fill" }).raw().toBuffer(),
    );
    return new Uint8Array(pixels);
  }

  async shrinkBelow(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array> {
    for (const edge of SHRINK_EDGES) {
      const jpeg = await this.#decoding(() =>
        sharp(bytes)
          .autoOrient()
          .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: SHRINK_QUALITY })
          .toBuffer(),
      );
      if (jpeg.byteLength <= maxBytes) {
        return new Uint8Array(jpeg);
      }
    }
    throw new InvalidImageError(`image does not fit in ${maxBytes} bytes even at ${SHRINK_EDGES.at(-1)} px`);
  }

  async #decoding<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw new InvalidImageError("image does not decode", { cause: error });
    }
  }
}
