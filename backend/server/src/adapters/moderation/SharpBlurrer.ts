import sharp, { type OverlayOptions } from "sharp";
import type { Box, PixelRect } from "../../domain/moderation/Box.js";
import type { Blurrer } from "../../ports/moderation/Blurrer.js";
import { callService } from "./utils.js";

interface RawImage {
  readonly data: Buffer;
  readonly raw: { readonly width: number; readonly height: number; readonly channels: 1 | 2 | 3 | 4 };
}

// Each region becomes a mosaic of at most CELLS x CELLS blocks before the blur.
const CELLS = 8;
const MIN_SIGMA = 0.3;

// Pixelates then blurs each box; sharp writes no metadata unless asked, so EXIF and GPS are dropped.
export class SharpBlurrer implements Blurrer {
  readonly #quality: number;

  constructor(quality = 85) {
    this.#quality = quality;
  }

  async obscure(jpeg: Uint8Array, boxes: readonly Box[]): Promise<Uint8Array> {
    return callService("sharp blur", () => this.#obscure(jpeg, boxes));
  }

  async #obscure(jpeg: Uint8Array, boxes: readonly Box[]): Promise<Uint8Array> {
    const { data, info } = await sharp(jpeg).autoOrient().removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const image: RawImage = { data, raw: { width: info.width, height: info.height, channels: info.channels } };
    const rects = boxes.flatMap((box) => box.toPixels(info.width, info.height) ?? []);
    const patches = await Promise.all(rects.map((rect) => this.#patch(image, rect)));
    const output = await sharp(data, { raw: image.raw }).composite(patches).jpeg({ quality: this.#quality }).toBuffer();
    return new Uint8Array(output);
  }

  async #patch(image: RawImage, rect: PixelRect): Promise<OverlayOptions> {
    const cells = { width: Math.min(CELLS, rect.width), height: Math.min(CELLS, rect.height) };
    const mosaic = await sharp(image.data, { raw: image.raw })
      .extract(rect)
      .resize(cells.width, cells.height, { fit: "fill" })
      .raw()
      .toBuffer();
    const sigma = Math.max(MIN_SIGMA, Math.max(rect.width, rect.height) / (CELLS * 2));
    const patch = await sharp(mosaic, { raw: { ...image.raw, ...cells } })
      .resize(rect.width, rect.height, { fit: "fill", kernel: "nearest" })
      .blur(sigma)
      .raw()
      .toBuffer();
    return { input: patch, raw: { ...image.raw, width: rect.width, height: rect.height }, left: rect.left, top: rect.top };
  }
}
