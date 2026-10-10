import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { SharpBlurrer } from "../../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../../src/adapters/moderation/SharpImageCodec.js";
import { validateModerationResult } from "../../src/contracts/index.gen.js";
import { GeoPoint } from "../../src/domain/moderation/GeoPoint.js";
import { PerceptualHash } from "../../src/domain/moderation/PerceptualHash.js";
import { PhotoSubmission } from "../../src/domain/moderation/PhotoSubmission.js";
import type { NoteModerator } from "../../src/ports/moderation/NoteModerator.js";
import { AuthenticityService } from "../../src/services/moderation/AuthenticityService.js";
import { CheckFactory } from "../../src/services/moderation/CheckFactory.js";
import { ModerationService } from "../../src/services/moderation/ModerationService.js";
import { PhotoLoader } from "../../src/services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../../src/services/moderation/PrivacyBlur.js";
import {
  box,
  DEVICE,
  FakeCleanNoteModerator,
  FakeClock,
  FakeDeviceRegistry,
  FakeFinder,
  FakeGeofence,
  FakeHashIndex,
  FakeImageModerator,
  FakeImageStore,
  FakeRemovingNoteModerator,
  FakeWasteLocator,
  JODHPUR,
  meanDiff,
  noiseJpeg,
  reportSubmission,
  sha256,
  sidewaysJpeg,
  testJpeg,
} from "./fakes.js";

class Harness {
  readonly store = new FakeImageStore();
  readonly gate = new FakeImageModerator();
  readonly faces = new FakeFinder("DetectFaces", null);
  readonly plates = new FakeFinder("DetectText+DetectLabels", "3.0+3.0");
  readonly waste = new FakeWasteLocator();
  readonly reportHashes = new FakeHashIndex();
  readonly cleanupHashes = new FakeHashIndex();
  readonly devices = new FakeDeviceRegistry();
  readonly india = new FakeGeofence();

  service(notes: NoteModerator = new FakeCleanNoteModerator()): ModerationService {
    const { india, reportHashes, cleanupHashes, devices } = this;
    const checks = new CheckFactory({ india, reportHashes, cleanupHashes, devices });
    return new ModerationService({
      loader: new PhotoLoader(this.store, new SharpImageCodec()),
      gate: this.gate,
      waste: this.waste,
      blur: new PrivacyBlur({ faces: this.faces, plates: this.plates, blurrer: new SharpBlurrer(), store: this.store }),
      authenticity: new AuthenticityService(checks),
      notes,
      clock: new FakeClock(),
    });
  }
}

let harness: Harness;
let jpeg: Uint8Array;

beforeEach(async () => {
  harness = new Harness();
  jpeg = await testJpeg();
  harness.store.originals.set("reports/upl_jdh_1.jpg", jpeg);
});

describe("ModerationService on a clean photo", () => {
  it("passes, blurs faces and plates into the public key and validates against the contract", async () => {
    harness.faces.boxes = [box(0.25, 0.33, 0.25, 0.33)];
    harness.plates.boxes = [box(0.7, 0.7, 0.1, 0.05)];
    const result = validateModerationResult(await harness.service().moderate(reportSubmission(jpeg, { note: "near the hall" })));
    expect(result).toMatchObject({ report_id: "rpt_jdh_1", outcome: "passed", reasons: [], duplicate_of: null });
    expect(result.blurred_key).toBe("media/reports/rpt_jdh_1.jpg");
    expect(result.blur).toEqual({ faces: 1, plates: 1, provider: "rekognition", model: "DetectFaces+DetectText+DetectLabels", version: "3.0+3.0" });
    expect(result.image_moderation).toEqual({ result: "pass", labels: [], provider: "rekognition", model: "DetectModerationLabels+DetectLabels", version: "7.0+3.0" });
    expect(Object.values(result.checks).map((check) => check.result)).toEqual(["pass", "pass", "pass", "pass", "pass"]);
    expect(result.note_moderation).toMatchObject({ result: "clean", provider: "bedrock" });
    expect(result.moderated_at).toBe("2026-10-10T02:15:03Z");
    expect(result.phash).toMatch(/^[0-9a-f]{16}$/);
    const blurred = harness.store.written.get("media/reports/rpt_jdh_1.jpg");
    expect(blurred).toBeDefined();
    expect((await sharp(blurred).metadata()).format).toBe("jpeg");
  });

  it("sends Rekognition an upright re-encode without EXIF, and blurs those same pixels", async () => {
    await harness.service().moderate(reportSubmission(jpeg));
    const seen = harness.gate.seen[0];
    expect(seen).not.toBe(jpeg);
    expect((await sharp(seen).metadata()).exif).toBeUndefined();
    const published = harness.store.written.get("media/reports/rpt_jdh_1.jpg");
    expect((await sharp(published).metadata()).width).toBe((await sharp(seen).metadata()).width);
  });

  it("blurs a face found in the upright frame of a photo stored sideways with EXIF orientation 6", async () => {
    const sideways = await sidewaysJpeg();
    harness.store.originals.set("reports/upl_jdh_1.jpg", sideways);
    // Upright, the stored checker square at x 10-50, y 10-50 sits at x 49-89, y 10-50 of a 100 x 200 image.
    harness.faces.boxes = [box(0.49, 0.05, 0.41, 0.2)];
    expect((await harness.service().moderate(reportSubmission(sideways))).outcome).toBe("passed");
    const seen = await sharp(harness.gate.seen[0]).metadata();
    expect(seen).toMatchObject({ width: 100, height: 200 });
    expect(seen.orientation).toBeUndefined();
    const upright = await sharp(sideways).autoOrient().removeAlpha().raw().toBuffer();
    const published = await sharp(harness.store.written.get("media/reports/rpt_jdh_1.jpg")).removeAlpha().raw().toBuffer();
    expect(meanDiff(upright, published, 100, (x, y) => x >= 49 && x < 89 && y >= 10 && y < 50)).toBeGreaterThan(40);
    expect(meanDiff(upright, published, 100, (_x, y) => y >= 120)).toBeLessThan(2);
  });

  it("shrinks a photo over 5 MB for Rekognition and publishes the same shrunk pixels", async () => {
    const big = await noiseJpeg(2100);
    expect(big.byteLength).toBeGreaterThan(5 * 1024 * 1024);
    harness.store.originals.set("reports/upl_jdh_1.jpg", big);
    expect((await harness.service().moderate(reportSubmission(big))).outcome).toBe("passed");
    const seen = harness.gate.seen[0];
    expect(seen?.byteLength).toBeLessThanOrEqual(5_000_000);
    const published = harness.store.written.get("media/reports/rpt_jdh_1.jpg");
    expect((await sharp(published).metadata()).width).toBe((await sharp(seen).metadata()).width);
  });

  it("leaves note_moderation null without a note and records a removed note without rejecting", async () => {
    const plain = await harness.service().moderate(reportSubmission(jpeg));
    expect(plain.note_moderation).toBeNull();
    const removed = await harness.service(new FakeRemovingNoteModerator()).moderate(reportSubmission(jpeg, { note: "call 98290 00000" }));
    expect(removed.outcome).toBe("passed");
    expect(removed.note_moderation).toMatchObject({ result: "removed", reasons: ["personal_data"] });
  });
});

describe("ModerationService rejections", () => {
  it.each([
    ["a PNG", async () => new Uint8Array(await sharp(await testJpeg()).png().toBuffer()), "not_jpeg"],
    ["a truncated JPEG", async () => (await testJpeg()).slice(0, 600), "undecodable"],
    ["a file over 8 MB", async () => new Uint8Array(8 * 1024 * 1024 + 1).fill(0xff), "over_8_mb"],
  ])("rejects %s as invalid_image before Rekognition", async (_name, makeBytes, cause) => {
    const bytes = await makeBytes();
    harness.store.originals.set("reports/upl_jdh_1.jpg", bytes);
    const result = validateModerationResult(await harness.service().moderate(reportSubmission(bytes)));
    expect(result).toMatchObject({ outcome: "rejected", reasons: ["invalid_image"], blurred_key: null, blur: null });
    expect(result.image_moderation).toMatchObject({ result: "fail", labels: [cause], provider: "junksnap" });
    expect(result.phash).toBe("0000000000000000");
    expect(Object.values(result.checks).every((check) => check.result === "skipped")).toBe(true);
    expect(harness.gate.seen).toHaveLength(0);
    expect(harness.store.written.size).toBe(0);
  });

  it("rejects bytes that do not match the client SHA-256", async () => {
    const result = await harness.service().moderate(reportSubmission(jpeg, { sha256: "0".repeat(64) }));
    expect(result.reasons).toEqual(["invalid_image"]);
    expect(result.image_moderation.labels).toEqual(["sha256_mismatch"]);
  });

  it("rejects an unsafe image with no public copy and every check skipped", async () => {
    harness.gate.moderationLabels = [
      { name: "Graphic Violence Or Gore", category: "Violence" },
      { name: "Corpses", category: "Visually Disturbing" },
    ];
    const result = validateModerationResult(await harness.service().moderate(reportSubmission(jpeg)));
    expect(result).toMatchObject({ outcome: "rejected", reasons: ["unsafe_image"], blurred_key: null, blur: null });
    expect(result.image_moderation).toMatchObject({ result: "fail", labels: ["Graphic Violence Or Gore"] });
    expect(result.checks.inside_india.result).toBe("skipped");
    expect(harness.store.written.size).toBe(0);
  });

  it("keeps Visually Disturbing photos, such as dead animals at a dump", async () => {
    harness.gate.moderationLabels = [{ name: "Corpses", category: "Visually Disturbing" }];
    expect((await harness.service().moderate(reportSubmission(jpeg))).outcome).toBe("passed");
  });

  it("rejects a person over a located waste box as person_dumping, with no public copy", async () => {
    harness.gate.people = [box(0.2, 0.1, 0.3, 0.7)];
    harness.waste.boxes = [{ label: "Garbage", box: box(0.3, 0.5, 0.4, 0.4) }];
    const result = validateModerationResult(await harness.service().moderate(reportSubmission(jpeg)));
    expect(result).toMatchObject({ reasons: ["person_dumping"], blurred_key: null, blur: null });
    expect(result.image_moderation.labels).toEqual(["Person", "Garbage"]);
    expect(harness.store.written.size).toBe(0);
  });

  it("gives the waste locator only the blurred copy", async () => {
    harness.faces.boxes = [box(0.25, 0.33, 0.25, 0.33)];
    await harness.service().moderate(reportSubmission(jpeg));
    expect(harness.waste.seen[0]).toEqual(harness.store.written.get("media/reports/rpt_jdh_1.jpg"));
    expect(harness.waste.seen[0]).not.toEqual(harness.gate.seen[0]);
  });

  it("keeps a person standing apart from the waste, and a person with no waste box at all", async () => {
    harness.gate.people = [box(0.0, 0.1, 0.2, 0.6)];
    harness.waste.boxes = [{ label: "Garbage", box: box(0.6, 0.5, 0.4, 0.4) }];
    expect((await harness.service().moderate(reportSubmission(jpeg))).outcome).toBe("passed");
    harness.waste.boxes = [];
    expect((await harness.service().moderate(reportSubmission(jpeg))).outcome).toBe("passed");
  });

  it("catches a duplicate of an earlier photo but never of itself", async () => {
    const hash = PerceptualHash.fromGrayscale(await new SharpImageCodec().grayscale(jpeg, PerceptualHash.SIDE));
    harness.reportHashes.photos = [{ photoId: "rpt_jdh_1", hash, location: JODHPUR }];
    expect((await harness.service().moderate(reportSubmission(jpeg))).outcome).toBe("passed");
    harness.reportHashes.photos.push({ photoId: "rpt_jdh_0", hash, location: JODHPUR });
    const result = validateModerationResult(await harness.service().moderate(reportSubmission(jpeg)));
    expect(result).toMatchObject({ outcome: "rejected", reasons: ["duplicate"], duplicate_of: "rpt_jdh_0" });
    expect(result.blurred_key).toBe("media/reports/rpt_jdh_1.jpg");
    expect([result.checks.rate_limit.result, result.checks.device_token.result]).toEqual(["skipped", "skipped"]);
  });

  it("stops the chain at the first failure", async () => {
    harness.india.inside = false;
    harness.devices.standings.device = { known: true, reputation: 0.1, blocked: true };
    const result = await harness.service().moderate(reportSubmission(jpeg));
    expect(result.reasons).toEqual(["outside_india"]);
    expect(result.checks.inside_india).toEqual({ result: "fail", detail: "point outside the India boundary" });
    expect(result.checks.device_token.result).toBe("skipped");
  });
});

describe("ModerationService on cleanup after-photos", () => {
  const site = new GeoPoint(26.2701, 73.0458);
  const cleanup = (bytes: Uint8Array, lat: number) =>
    PhotoSubmission.fromCleanup(
      {
        site_id: "site_jdh_3",
        upload_id: "upl_jdh_3c",
        device_token: DEVICE,
        sha256: sha256(bytes),
        gps: { lat, lon: 73.0458 },
        captured_at: "2026-10-09T06:20:00Z",
        received_at: "2026-10-09T06:21:10Z",
      },
      site,
    );

  beforeEach(() => {
    harness.store.originals.set("cleanups/upl_jdh_3c.jpg", jpeg);
  });

  it("passes near_site within 50 m and writes the cleanup key", async () => {
    const result = validateModerationResult(await harness.service().moderate(cleanup(jpeg, 26.2702)));
    expect(result).toMatchObject({ report_id: "cln_jdh_3c", outcome: "passed", blurred_key: "media/cleanups/cln_jdh_3c.jpg" });
    expect(result.checks.near_site).toEqual({ result: "pass", detail: "after-photo 12 m from the site; limit 50 m" });
  });

  it("rejects an after-photo taken away from the site", async () => {
    const result = validateModerationResult(await harness.service().moderate(cleanup(jpeg, 26.2711)));
    expect(result.reasons).toEqual(["not_near_site"]);
    expect(result.checks.near_site?.result).toBe("fail");
  });

  it("compares an after-photo with earlier after-photos of the site, never with its before-photos", async () => {
    const hash = PerceptualHash.fromGrayscale(await new SharpImageCodec().grayscale(jpeg, PerceptualHash.SIDE));
    const near = new GeoPoint(26.2702, 73.0458);
    harness.reportHashes.photos = [{ photoId: "rpt_jdh_3", hash, location: near }];
    expect((await harness.service().moderate(cleanup(jpeg, 26.2702))).outcome).toBe("passed");
    harness.cleanupHashes.photos = [{ photoId: "cln_jdh_3b", hash, location: near }];
    const result = validateModerationResult(await harness.service().moderate(cleanup(jpeg, 26.2702)));
    expect(result).toMatchObject({ reasons: ["duplicate"], duplicate_of: "cln_jdh_3b" });
    expect(result.checks.duplicate.detail).toBe("pHash distance 0 to an earlier after-photo of this site within 100 m; limit 8");
  });

  it("keeps near_site in a rejected cleanup, as the schema requires", async () => {
    harness.store.originals.set("cleanups/upl_jdh_3c.jpg", jpeg.slice(0, 600));
    const result = validateModerationResult(await harness.service().moderate(cleanup(jpeg.slice(0, 600), 26.2702)));
    expect(result.checks.near_site?.result).toBe("skipped");
  });
});
