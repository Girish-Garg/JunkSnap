import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SharpBlurrer } from "../../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../../src/adapters/moderation/SharpImageCodec.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { InvalidImageError } from "../../src/domain/moderation/errors.js";
import { PerceptualHash } from "../../src/domain/moderation/PerceptualHash.js";
import { FACE_PADDING, PLATE_PADDING, PrivacyBlur } from "../../src/services/moderation/PrivacyBlur.js";
import { box, FakeFinder, FakeImageStore, FakeSubjectFinder, meanDiff, noiseJpeg, sidewaysJpeg, testJpeg } from "./fakes.js";

const codec = new SharpImageCodec();

async function hashOf(jpeg: Uint8Array): Promise<PerceptualHash> {
  return PerceptualHash.fromGrayscale(await codec.grayscale(jpeg, PerceptualHash.SIDE));
}

async function rgb(jpeg: Uint8Array): Promise<{ data: Buffer; width: number }> {
  const { data, info } = await sharp(jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
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

  it("re-encodes upright and without EXIF, at full size when it fits", async () => {
    const withExif = new Uint8Array(await sharp(await testJpeg()).withExif({ IFD0: { Make: "PhoneMaker" } }).jpeg().toBuffer());
    const meta = await sharp(await codec.uprightBelow(withExif, 5_000_000)).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: 256, height: 192 });
    expect(meta.exif).toBeUndefined();
    expect(await sharp(await codec.uprightBelow(await sidewaysJpeg(), 5_000_000)).metadata()).toMatchObject({ width: 100, height: 200 });
  });

  it("shrinks below a byte limit and keeps the aspect ratio", async () => {
    const big = await noiseJpeg(1200);
    const small = await codec.uprightBelow(big, big.byteLength / 2);
    expect(small.byteLength).toBeLessThanOrEqual(big.byteLength / 2);
    const meta = await sharp(small).metadata();
    expect(meta.width).toBe(meta.height);
  });
});

describe("SharpBlurrer", () => {
  const blurrer = new SharpBlurrer(95);
  // The checkerboard square at pixels 64 to 128 in both directions of the 256 x 192 test image.
  const target = { box: box(64 / 256, 64 / 192, 64 / 256, 64 / 192), padding: { fraction: 0, minPixels: 0 } };

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
    const none = { fraction: 0, minPixels: 0 };
    const regions = [{ box: box(0.5, 0.5, 0, 0), padding: none }, { box: box(1.2, 1.2, 0.1, 0.1), padding: none }];
    const out = await blurrer.obscure(await testJpeg(), regions);
    expect((await sharp(out).metadata()).width).toBe(256);
  });
});

describe("PrivacyBlur padding", () => {
  it("grows face boxes by 40% and gives plates at least 6 px or 30% on every side", () => {
    expect(box(0.4, 0.4, 0.2, 0.2).toPaddedPixels(FACE_PADDING, 100, 100)).toEqual({ left: 36, top: 36, width: 28, height: 28 });
    // A tight 20 x 10 px OCR box: 30% would add only 3 px and 1.5 px, so the 6 px minimum applies.
    expect(box(0.5, 0.5, 0.02, 0.01).toPaddedPixels(PLATE_PADDING, 1000, 1000)).toEqual({ left: 494, top: 494, width: 32, height: 22 });
    expect(box(0.5, 0.5, 0.2, 0.1).toPaddedPixels(PLATE_PADDING, 1000, 1000)).toEqual({ left: 470, top: 485, width: 260, height: 130 });
  });

  it("blurs past the edge of a tight plate box", async () => {
    const plates = new FakeFinder("DetectText", "3.0");
    // 16 x 8 px inside the checkerboard; the 6 px margin reaches x 66 to 94 and y 66 to 86.
    plates.boxes = [box(72 / 256, 72 / 192, 16 / 256, 8 / 192)];
    const ports = { faces: new FakeFinder("DetectFaces", null), plates, subjects: new FakeSubjectFinder() };
    const blur = new PrivacyBlur({ ...ports, blurrer: new SharpBlurrer(95), store: new FakeImageStore() });
    const upright = await testJpeg();
    const blurred = await blur.blur({ upright, hash: PerceptualHash.fromHex("0000000000000000"), brightness: 0.5 });
    const before = await rgb(upright);
    const after = await rgb(blurred.jpeg);
    expect(meanDiff(before.data, after.data, before.width, (x, y) => x >= 66 && x < 72 && y >= 72 && y < 80)).toBeGreaterThan(30);
    expect(meanDiff(before.data, after.data, before.width, (x, y) => x >= 104 && y >= 104 && x < 128 && y < 128)).toBeLessThan(1.5);
    expect(blurred.record.toContract()).toMatchObject({ faces: 0, plates: 1 });
  });
});
