import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { RekognitionFaceFinder } from "../../src/adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionPlateFinder } from "../../src/adapters/moderation/RekognitionPlateFinder.js";
import { RekognitionSubjectFinder } from "../../src/adapters/moderation/RekognitionSubjectFinder.js";
import { SharpBlurrer } from "../../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../../src/adapters/moderation/SharpImageCodec.js";
import { validateModerationResult } from "../../src/contracts/index.gen.js";
import { BlurPlanner, FACE_PADDING, PLATE_PADDING, WHOLE_PADDING, ZONE_PADDING } from "../../src/domain/moderation/BlurPlanner.js";
import type { BlurRegion } from "../../src/domain/moderation/Box.js";
import { PerceptualHash } from "../../src/domain/moderation/PerceptualHash.js";
import type { Subject } from "../../src/domain/moderation/Subject.js";
import type { Blurrer } from "../../src/ports/moderation/Blurrer.js";
import type { ImageStore } from "../../src/ports/moderation/ImageStore.js";
import { PhotoLoader } from "../../src/services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../../src/services/moderation/PrivacyBlur.js";
import { box, FakeImageStore, meanDiff, testJpeg } from "./fakes.js";

type Fixture = Record<"DetectFaces" | "DetectText" | "DetectLabels", unknown>;

function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/rekognition/${name}.json`, import.meta.url)), "utf8")) as Fixture;
}

// A Rekognition client whose DetectFaces, DetectText and DetectLabels answer from one fixture file.
function rekognitionFrom(responses: Fixture): RekognitionClient {
  const client = new RekognitionClient({ region: "ap-south-1" });
  vi.spyOn(client as unknown as { send: (command: object) => Promise<unknown> }, "send").mockImplementation(async (command) => {
    const operation = command.constructor.name.replace(/Command$/, "") as keyof Fixture;
    return responses[operation];
  });
  return client;
}

class RecordingBlurrer implements Blurrer {
  regions: readonly BlurRegion[] = [];

  async obscure(jpeg: Uint8Array, regions: readonly BlurRegion[]): Promise<Uint8Array> {
    this.regions = regions;
    return jpeg;
  }
}

function privacyBlur(name: string, blurrer: Blurrer, store: ImageStore = new FakeImageStore()): PrivacyBlur {
  const client = rekognitionFrom(fixture(name));
  const finders = { faces: new RekognitionFaceFinder(client), plates: new RekognitionPlateFinder(client), subjects: new RekognitionSubjectFinder(client) };
  return new PrivacyBlur({ ...finders, blurrer, store });
}

// A night street: dark grey everywhere, with a sharp white checkerboard "plate" low on the first motorbike's box.
async function nightJpeg(): Promise<Uint8Array> {
  const width = 400;
  const height = 300;
  const pixels = Buffer.alloc(width * height * 3, 18);
  for (let y = 200; y < 224; y += 1) {
    for (let x = 150; x < 182; x += 1) {
      pixels.fill((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 255 : 18, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  return new Uint8Array(await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95 }).toBuffer());
}

async function loaded(jpeg: Uint8Array) {
  const load = await new PhotoLoader(new FakeImageStore(), new SharpImageCodec()).decode(jpeg);
  if (!("photo" in load)) {
    throw new Error(`test image did not load: ${load.invalid}`);
  }
  return load.photo;
}

const HASH = PerceptualHash.fromHex("0000000000000000");
const person = (left: number, top: number, height: number, confidence = 95): Subject => ({ kind: "person", box: box(left, top, 0.1, height), confidence });
const car = (left: number, top: number, confidence = 95): Subject => ({ kind: "vehicle", box: box(left, top, 0.3, 0.3), confidence });
const bike = (left: number, top: number): Subject => ({ kind: "two_wheeler", box: box(left, top, 0.2, 0.4), confidence: 95 });
const bright = { faces: [], textPlates: [], labelPlates: [], subjects: [], brightness: 0.6 };

describe("BlurPlanner", () => {
  const planner = new BlurPlanner();

  it("blurs the head of a person with no face found, and nothing more when a face is inside the box", () => {
    const plan = planner.plan({ ...bright, faces: [box(0.52, 0.12, 0.05, 0.06)], subjects: [person(0.1, 0.1, 0.6), person(0.5, 0.1, 0.6)] });
    expect(plan.counts).toMatchObject({ faces: 1, heads: 1, people: 0 });
    expect(plan.regions[1]).toEqual({ box: box(0.1, 0.1, 0.1, 0.15), padding: ZONE_PADDING });
  });

  it("blurs the lower plate zone of a vehicle with no plate found: 60% of a car, 75% of a two-wheeler", () => {
    const plan = planner.plan({ ...bright, subjects: [car(0.1, 0.5), bike(0.6, 0.4)] });
    expect(plan.counts).toMatchObject({ plate_zones: 2, vehicles: 0 });
    const zones = plan.regions.map((region) => region.box);
    expect(zones[0]?.top).toBeCloseTo(0.62);
    expect(zones[0]?.bottom).toBeCloseTo(0.8);
    expect(zones[1]?.top).toBeCloseTo(0.5);
    expect(zones[1]?.bottom).toBeCloseTo(0.8);
  });

  it("blurs a car whole when it is unsure, and a person whole when the box is small", () => {
    const plan = planner.plan({ ...bright, subjects: [car(0.1, 0.5, 55), person(0.6, 0.1, 0.12)] });
    expect(plan.counts).toMatchObject({ vehicles: 1, people: 1, heads: 0, plate_zones: 0 });
    expect(plan.regions.every((region) => region.padding === WHOLE_PADDING)).toBe(true);
  });

  it("blurs every person and vehicle whole in a dark photo, even with a face found", () => {
    const plan = planner.plan({ ...bright, brightness: 0.1, faces: [box(0.12, 0.12, 0.05, 0.06)], subjects: [person(0.1, 0.1, 0.6), car(0.5, 0.5)] });
    expect(plan.lowLight).toBe(true);
    expect(plan.counts).toEqual({ faces: 1, plates: 0, heads: 0, plate_zones: 0, people: 1, vehicles: 1 });
  });

  it("counts a label plate only when no text plate covers it", () => {
    const plan = planner.plan({ ...bright, textPlates: [box(0.6, 0.7, 0.08, 0.03)], labelPlates: [box(0.61, 0.7, 0.07, 0.03), box(0.1, 0.9, 0.05, 0.02)] });
    expect(plan.counts.plates).toBe(2);
    expect(plan.regions.every((region) => region.padding === PLATE_PADDING)).toBe(true);
  });
});

describe("PrivacyBlur on Rekognition fixtures", () => {
  it("blurs the people and motorbikes of a night photo where DetectFaces and DetectText found nothing (issue 110)", async () => {
    const blurrer = new RecordingBlurrer();
    const photo = await loaded(await nightJpeg());
    expect(photo.brightness).toBeLessThan(0.3);
    const record = (await privacyBlur("night_road", blurrer).blur(photo)).record.toContract();
    expect(record).toMatchObject({ faces: 0, plates: 0, low_light: true, model: "DetectFaces+DetectText+DetectLabels", version: "3.0+3.0" });
    expect(record.regions).toEqual({ faces: 0, plates: 0, heads: 0, plate_zones: 0, people: 2, vehicles: 3 });
    expect(blurrer.regions).toHaveLength(5);
  });

  it("makes the night photo's plate unreadable and leaves the empty road as it was", async () => {
    const night = await nightJpeg();
    const blurred = await privacyBlur("night_road", new SharpBlurrer(95)).blur(await loaded(night));
    const before = await sharp(night).removeAlpha().raw().toBuffer();
    const after = await sharp(blurred.jpeg).removeAlpha().raw().toBuffer();
    expect(meanDiff(before, after, 400, (x, y) => x >= 150 && x < 182 && y >= 200 && y < 224)).toBeGreaterThan(40);
    expect(meanDiff(before, after, 400, (x, y) => x >= 230 && x < 280 && y < 100)).toBeLessThan(1.5);
  });

  it("uses head and plate zones on the same scene in daylight, and whole boxes for the unsure ones", async () => {
    const photo = { upright: await testJpeg(), hash: HASH, brightness: 0.6 };
    const record = (await privacyBlur("night_road", new RecordingBlurrer()).blur(photo)).record.toContract();
    expect(record.regions).toEqual({ faces: 0, plates: 0, heads: 1, plate_zones: 2, people: 1, vehicles: 1 });
    expect(record.low_light).toBe(false);
  });

  it("leaves the normal case as before: only the found face and plate are blurred, with the same evidence", async () => {
    const blurrer = new RecordingBlurrer();
    const photo = { upright: await testJpeg(), hash: HASH, brightness: 0.6 };
    const record = (await privacyBlur("daylight_road", blurrer).blur(photo)).record.toContract();
    expect(blurrer.regions).toEqual([
      { box: box(0.2, 0.18, 0.05, 0.07), padding: FACE_PADDING },
      { box: box(0.6, 0.7, 0.08, 0.03), padding: PLATE_PADDING },
    ]);
    expect(record).toEqual({
      faces: 1,
      plates: 1,
      provider: "rekognition",
      model: "DetectFaces+DetectText+DetectLabels",
      version: "3.0+3.0",
      regions: { faces: 1, plates: 1, heads: 0, plate_zones: 0, people: 0, vehicles: 0 },
      low_light: false,
    });
  });

  it("blurs nothing on a plain dump photo, and the record still fits the contract", async () => {
    const blurrer = new RecordingBlurrer();
    const photo = { upright: await testJpeg(), hash: HASH, brightness: 0.6 };
    const blur = (await privacyBlur("dump_only", blurrer).blur(photo)).record.toContract();
    expect(blurrer.regions).toEqual([]);
    const result = JSON.parse(readFileSync(fileURLToPath(new URL("../../../../contracts/fixtures/moderation_result.jdh-1.json", import.meta.url)), "utf8")) as object;
    expect(validateModerationResult({ ...result, blur }).blur).toEqual(blur);
  });
});
