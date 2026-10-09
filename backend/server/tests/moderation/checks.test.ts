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
import { DEVICE, FakeDeviceRegistry, FakeHashIndex, JODHPUR, reportUpload, RECEIVED_AT } from "./fakes.js";

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

const USER = "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7";

describe("RateLimitCheck", () => {
  it.each([
    [20, 3, "pass", "20 photos in the last hour; limit 20"],
    [21, 3, "fail", "21 photos in the last hour; limit 20"],
    [2, 21, "fail", "21 photos in the last hour; limit 20"],
    [1, 1, "pass", "1 photo in the last hour; limit 20"],
  ] as const)("snap: device %i and account %i gives %s, the stricter count", async (device, user, result, detail) => {
    const devices = new FakeDeviceRegistry();
    Object.assign(devices.counts, { device, user });
    const outcome = await new RateLimitCheck(devices).run(subject({ user_id: USER }));
    expect(outcome.toContract()).toEqual({ result, detail });
  });

  it("counts a guest report by device only, over the hour that ends at received_at", async () => {
    const devices = new FakeDeviceRegistry();
    devices.counts.user = 99;
    expect((await new RateLimitCheck(devices).run(subject())).failed).toBe(false);
    expect(devices.windows).toEqual([
      { sender: { kind: "device", id: DEVICE }, from: new Date("2026-10-10T01:14:52Z"), to: new Date(RECEIVED_AT) },
    ]);
  });

  it("passes scan frames without counting them, as the frame sampler limits them", async () => {
    const devices = new FakeDeviceRegistry();
    devices.counts.device = 99;
    const outcome = await new RateLimitCheck(devices).run(subject({ capture_mode: "scan" }));
    expect(outcome.toContract()).toEqual({ result: "pass", detail: "scan frame; the frame sampler keeps 1 per second" });
    expect(devices.windows).toEqual([]);
  });
});

describe("DeviceTokenCheck", () => {
  it.each([
    [{ known: true, reputation: 0.74, blocked: false }, "pass", "known device, reputation 0.74"],
    [{ known: false, reputation: 0.5, blocked: false }, "pass", "new device, reputation 0.5"],
    [{ known: true, reputation: 0.1, blocked: true }, "fail", "device blocked"],
  ])("guest with %o gives %s", async (standing, result, detail) => {
    const devices = new FakeDeviceRegistry();
    devices.standings.device = standing;
    const check = new DeviceTokenCheck(devices);
    expect((await check.run(subject())).toContract()).toEqual({ result, detail });
    expect(check.reason).toBe("blocked_device");
  });

  it("reports the lower reputation of device and account, and fails a blocked account", async () => {
    const devices = new FakeDeviceRegistry();
    devices.standings.user = { known: true, reputation: 0.31, blocked: false };
    const check = new DeviceTokenCheck(devices);
    expect((await check.run(subject({ user_id: USER }))).detail).toBe("known device, reputation 0.31");
    devices.standings.user = { known: true, reputation: 0.9, blocked: true };
    expect((await check.run(subject({ user_id: USER }))).toContract()).toEqual({ result: "fail", detail: "account blocked" });
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

  it("passes at 48.9 m and fails at 50.04 m", async () => {
    expect((await new NearSiteCheck().run(cleanupAt(26.27054))).toContract()).toEqual({
      result: "pass",
      detail: "after-photo 49 m from the site; limit 50 m",
    });
    expect((await new NearSiteCheck().run(cleanupAt(26.27055))).toContract()).toEqual({
      result: "fail",
      detail: "after-photo 51 m from the site; limit 50 m",
    });
  });

  it("refuses a report photo, which has no site", async () => {
    await expect(new NearSiteCheck().run(subject())).rejects.toThrow(/without a site/);
  });
});
