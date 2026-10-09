import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TurfGeofence } from "../../src/adapters/moderation/TurfGeofence.js";
import { ConfigError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/moderation/GeoPoint.js";
import { PerceptualHash } from "../../src/domain/moderation/PerceptualHash.js";
import { PhotoSubmission } from "../../src/domain/moderation/PhotoSubmission.js";
import { INDIA_BUFFER_DEG } from "../../src/handlers/moderation/ModerationServiceFactory.js";
import type { CheckSubject } from "../../src/services/moderation/checks/Check.js";
import { DeviceTokenCheck } from "../../src/services/moderation/checks/DeviceTokenCheck.js";
import { DuplicateCheck } from "../../src/services/moderation/checks/DuplicateCheck.js";
import { FreshTimestampCheck } from "../../src/services/moderation/checks/FreshTimestampCheck.js";
import { InsideIndiaCheck } from "../../src/services/moderation/checks/InsideIndiaCheck.js";
import { NearSiteCheck } from "../../src/services/moderation/checks/NearSiteCheck.js";
import { RateLimitCheck } from "../../src/services/moderation/checks/RateLimitCheck.js";
import { FakeDeviceRegistry, FakeHashIndex, JODHPUR, reportUpload, RECEIVED_AT } from "./fakes.js";

const OUTLINE = fileURLToPath(new URL("../../../../data/boundaries/india_outline.geojson", import.meta.url));
const HASH = PerceptualHash.fromHex("c4e1b3a59d0f2687");
const NO_BYTES = new Uint8Array();

function subject(overrides: Parameters<typeof reportUpload>[1] = {}, receivedAt = RECEIVED_AT): CheckSubject {
  return { submission: PhotoSubmission.fromReport(reportUpload(NO_BYTES, overrides), receivedAt), hash: HASH };
}

function at(lat: number, lon: number): CheckSubject {
  return subject({ gps: { lat, lon, accuracy_m: 10 } });
}

describe("InsideIndiaCheck on the real outline, buffered 0.02 degrees", () => {
  const check = new InsideIndiaCheck(TurfGeofence.fromFile(OUTLINE, INDIA_BUFFER_DEG));

  it.each([
    ["Jodhpur", 26.2618, 73.0035],
    ["Jaipur", 26.9124, 75.7873],
    ["Mumbai CST, inside only thanks to the buffer", 18.9398, 72.8355],
    ["Kavaratti", 10.5593, 72.6358],
    ["Port Blair", 11.6234, 92.7265],
    ["Leh", 34.1526, 77.5771],
  ])("passes %s", async (_name, lat, lon) => {
    expect(await check.run(at(lat, lon))).toMatchObject({ result: "pass", detail: "point inside the India boundary" });
  });

  it.each([
    ["Lahore", 31.5204, 74.3587],
    ["Kathmandu", 27.7172, 85.324],
    ["Dhaka", 23.8103, 90.4125],
    ["Colombo", 6.9271, 79.8612],
    ["the Arabian Sea", 15.0, 65.0],
  ])("fails %s", async (_name, lat, lon) => {
    const outcome = await check.run(at(lat, lon));
    expect(outcome.failed).toBe(true);
    expect(check.reason).toBe("outside_india");
  });

  it("refuses a file that is not a FeatureCollection of polygons", () => {
    expect(() => TurfGeofence.fromFile(fileURLToPath(import.meta.url), INDIA_BUFFER_DEG)).toThrow(ConfigError);
  });
});

describe("FreshTimestampCheck", () => {
  const check = new FreshTimestampCheck();

  it.each([
    ["2026-10-10T02:14:05Z", "pass", "captured 47 s before upload; limit 72 h"],
    ["2026-10-07T03:00:00Z", "pass", "captured 71 h before upload; limit 72 h"],
    ["2026-10-07T02:00:00Z", "fail", "captured 72 h before upload; limit 72 h"],
    ["2026-10-01T00:00:00Z", "fail", "captured 218 h before upload; limit 72 h"],
    ["2026-10-10T02:18:00Z", "pass", "captured 3 min after upload; limit 5 min"],
    ["2026-10-10T02:30:00Z", "fail", "captured 15 min after upload; limit 5 min"],
  ])("captured_at %s gives %s", async (capturedAt, result, detail) => {
    expect((await check.run(subject({ captured_at: capturedAt }))).toContract()).toEqual({ result, detail });
  });

  it("fails an unreadable capture time", async () => {
    expect((await check.run(subject({ captured_at: "yesterday" }))).failed).toBe(true);
  });
});

describe("DuplicateCheck", () => {
  const near = new GeoPoint(JODHPUR.lat + 0.0005, JODHPUR.lon);
  const far = new GeoPoint(JODHPUR.lat + 0.002, JODHPUR.lon);
  const flipped = (bits: number) => PerceptualHash.fromHex((0xc4e1b3a59d0f2687n ^ ((1n << BigInt(bits)) - 1n)).toString(16).padStart(16, "0"));

  function checkWith(...photos: { photoId: string; hash: PerceptualHash; location: GeoPoint }[]): DuplicateCheck {
    const index = new FakeHashIndex();
    index.photos = photos;
    return new DuplicateCheck(index);
  }

  it("passes when nothing was photographed nearby", async () => {
    expect((await checkWith().run(subject())).detail).toBe("no earlier photo within 100 m");
  });

  it("fails at distance 8 within 100 m and names the earlier photo", async () => {
    const outcome = await checkWith({ photoId: "rpt_old", hash: flipped(8), location: near }).run(subject());
    expect(outcome.toContract()).toEqual({ result: "fail", detail: "pHash distance 8 to an earlier photo within 100 m; limit 8" });
    expect(outcome.duplicateOf).toBe("rpt_old");
  });

  it("passes at distance 9 and reports the nearest distance", async () => {
    const outcome = await checkWith({ photoId: "rpt_old", hash: flipped(9), location: near }).run(subject());
    expect(outcome.toContract()).toEqual({ result: "pass", detail: "nearest earlier photo at pHash distance 9; limit 8" });
  });

  it("ignores the same photo more than 100 m away", async () => {
    expect((await checkWith({ photoId: "rpt_old", hash: HASH, location: far }).run(subject())).failed).toBe(false);
  });

  it("never flags the photo as a duplicate of itself, so retries pass", async () => {
    expect((await checkWith({ photoId: "rpt_jdh_1", hash: HASH, location: JODHPUR }).run(subject())).failed).toBe(false);
  });
});

describe("RateLimitCheck", () => {
  it.each([
    ["snap", 20, "pass", "20 photos in the last hour; limit 20"],
    ["snap", 21, "fail", "21 photos in the last hour; limit 20"],
    ["scan", 1, "pass", "1 frame in the last second; limit 1"],
    ["scan", 2, "fail", "2 frames in the last second; limit 1"],
  ] as const)("%s with %i in the window gives %s", async (mode, count, result, detail) => {
    const devices = new FakeDeviceRegistry();
    devices.count = count;
    const outcome = await new RateLimitCheck(devices).run(subject({ capture_mode: mode }));
    expect(outcome.toContract()).toEqual({ result, detail });
  });

  it("asks for the window that ends at received_at", async () => {
    const devices = new FakeDeviceRegistry();
    await new RateLimitCheck(devices).run(subject());
    expect(devices.windows[0]).toMatchObject({ mode: "snap", from: new Date("2026-10-10T01:14:52Z"), to: new Date(RECEIVED_AT) });
  });
});

describe("DeviceTokenCheck", () => {
  it.each([
    [{ known: true, reputation: 0.74, blocked: false }, "pass", "known device, reputation 0.74"],
    [{ known: false, reputation: 0.5, blocked: false }, "pass", "new device, reputation 0.5"],
    [{ known: true, reputation: 0.1, blocked: true }, "fail", "device blocked"],
  ])("%o gives %s", async (standing, result, detail) => {
    const devices = new FakeDeviceRegistry();
    devices.standingValue = standing;
    const check = new DeviceTokenCheck(devices);
    expect((await check.run(subject())).toContract()).toEqual({ result, detail });
    expect(check.reason).toBe("blocked_device");
  });
});

describe("NearSiteCheck", () => {
  const cleanupAt = (lat: number): CheckSubject => ({
    submission: PhotoSubmission.fromCleanup(
      {
        upload_id: "upl_x",
        device_token: "d",
        sha256: "0".repeat(64),
        gps: { lat, lon: 73.0458 },
        captured_at: RECEIVED_AT,
        received_at: RECEIVED_AT,
      },
      new GeoPoint(26.2701, 73.0458),
    ),
    hash: HASH,
  });

  it("passes at 50 m and fails at 61 m", async () => {
    expect((await new NearSiteCheck().run(cleanupAt(26.27055))).toContract()).toEqual({
      result: "pass",
      detail: "after-photo 50 m from the site; limit 50 m",
    });
    expect((await new NearSiteCheck().run(cleanupAt(26.27065))).failed).toBe(true);
  });

  it("refuses a report photo, which has no site", async () => {
    await expect(new NearSiteCheck().run(subject())).rejects.toThrow(/without a site/);
  });
});
