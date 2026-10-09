import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SharpBlurrer } from "../../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../../src/adapters/moderation/SharpImageCodec.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { InvalidImageError } from "../../src/domain/moderation/errors.js";
import { PerceptualHash } from "../../src/domain/moderation/PerceptualHash.js";
import { box, noiseJpeg, testJpeg } from "./fakes.js";

const codec = new SharpImageCodec();

async function hashOf(jpeg: Uint8Array): Promise<PerceptualHash> {
  return PerceptualHash.fromGrayscale(await codec.grayscale(jpeg, PerceptualHash.SIDE));
}

async function rgb(jpeg: Uint8Array): Promise<{ data: Buffer; width: number }> {
  const { data, info } = await sharp(jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

// Mean absolute channel difference over the pixels for which `inside(x, y)` holds.
function meanDiff(a: Buffer, b: Buffer, width: number, inside: (x: number, y: number) => boolean): number {
  let total = 0;
  let count = 0;
  for (let i = 0; i < a.length; i += 3) {
    const pixel = i / 3;
    if (inside(pixel % width, Math.floor(pixel / width))) {
      total += Math.abs((a[i] ?? 0) - (b[i] ?? 0)) + Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0));
      count += 2;
    }
  }
  return total / count;
}

describe("PerceptualHash", () => {
  it("is stable for the same photo and close for a re-encoded, resized copy", async () => {
    const original = await testJpeg(512, 384);
    const copy = new Uint8Array(await sharp(original).resize(300).jpeg({ quality: 60 }).toBuffer());
    expect((await hashOf(original)).distanceTo(await hashOf(original))).toBe(0);
    expect((await hashOf(original)).distanceTo(await hashOf(copy))).toBeLessThanOrEqual(8);
  });

  it("is far for a different photo", async () => {
    const flipped = new Uint8Array(await sharp(await testJpeg(512, 384)).flop().toBuffer());
    expect((await hashOf(await testJpeg(512, 384))).distanceTo(await hashOf(flipped))).toBeGreaterThan(8);
    expect((await hashOf(await testJpeg())).distanceTo(await hashOf(await noiseJpeg(64)))).toBeGreaterThan(8);
  });

  it("round-trips through 16 hex digits and counts differing bits", () => {
    const hash = PerceptualHash.fromHex("00000000000000ff");
    expect(hash.toHex()).toBe("00000000000000ff");
    expect(hash.distanceTo(PerceptualHash.fromHex("0000000000000000"))).toBe(8);
    expect(() => PerceptualHash.fromHex("xyz")).toThrow(InternalDataError);
    expect(() => PerceptualHash.fromGrayscale(new Uint8Array(10))).toThrow(InternalDataError);
  });
});

describe("SharpImageCodec", () => {
  it("describes a JPEG and refuses bytes that do not decode", async () => {
    expect(await codec.describe(await testJpeg())).toEqual({ format: "jpeg", width: 256, height: 192 });
    await expect(codec.describe(new Uint8Array([1, 2, 3]))).rejects.toThrow(InvalidImageError);
    await expect(codec.grayscale((await testJpeg()).slice(0, 600), 32)).rejects.toThrow(InvalidImageError);
  });

  it("shrinks below a byte limit and keeps the aspect ratio", async () => {
    const big = await noiseJpeg(1200);
    const small = await codec.shrinkBelow(big, big.byteLength / 2);
    expect(small.byteLength).toBeLessThanOrEqual(big.byteLength / 2);
    const meta = await sharp(small).metadata();
    expect(meta.width).toBe(meta.height);
  });
});

describe("SharpBlurrer", () => {
  const blurrer = new SharpBlurrer(95);
  // The checkerboard square at pixels 64 to 128 in both directions of the 256 x 192 test image.
  const target = box(64 / 256, 64 / 192, 64 / 256, 64 / 192);

  it("changes pixels inside the box and leaves the rest as it was", async () => {
    const original = await testJpeg();
    const before = await rgb(original);
    const after = await rgb(await blurrer.obscure(original, [target]));
    const inBox = (x: number, y: number) => x >= 64 && x < 128 && y >= 64 && y < 128;
    // JPEG blocks are 8 pixels wide, so re-encoding may touch one block around the box edge.
    const wellOutside = (x: number, y: number) => x < 56 || x >= 136 || y < 56 || y >= 136;
    expect(meanDiff(before.data, after.data, before.width, inBox)).toBeGreaterThan(40);
    expect(meanDiff(before.data, after.data, before.width, wellOutside)).toBeLessThan(1.5);
  });

  it("returns a JPEG without the original's EXIF", async () => {
    const withExif = new Uint8Array(
      await sharp(await testJpeg()).withExif({ IFD0: { Copyright: "test", Make: "PhoneMaker" } }).jpeg().toBuffer(),
    );
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const meta = await sharp(await blurrer.obscure(withExif, [target])).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
  });

  it("ignores boxes that cover no whole pixel", async () => {
    const out = await blurrer.obscure(await testJpeg(), [box(0.5, 0.5, 0, 0), box(1.2, 1.2, 0.1, 0.1)]);
    expect((await sharp(out).metadata()).width).toBe(256);
  });
});
