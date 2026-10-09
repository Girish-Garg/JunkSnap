import { describe, expect, it } from "vitest";
import type { GpsFix } from "../src/domain/ScanFrame.js";
import { ValidationError } from "../src/domain/errors.js";
import { GpsInterpolator } from "../src/services/GpsInterpolator.js";
import { ScanSessionRules } from "../src/services/ScanSessionRules.js";
import { sampleSession } from "./scanFakes.js";

function fix(tMs: number, lat: number, lon: number, accuracyM = 10): GpsFix {
  return { t_ms: tMs, lat, lon, accuracy_m: accuracyM };
}

describe("GpsInterpolator", () => {
  const track = [fix(0, 26.27, 73.01, 8), fix(2000, 26.272, 73.014, 12), fix(4000, 26.274, 73.018, 10)];
  const gps = new GpsInterpolator(track);

  it("returns a fix unchanged at its own time", () => {
    expect(gps.locate(2000)).toEqual({ lat: 26.272, lon: 73.014, accuracy_m: 12 });
  });

  it("interpolates linearly between the fixes either side, taking the worse accuracy", () => {
    expect(gps.locate(500)).toEqual({ lat: 26.2705, lon: 73.011, accuracy_m: 12 });
    expect(gps.locate(3000)).toEqual({ lat: 26.273, lon: 73.016, accuracy_m: 12 });
  });

  it("uses the first or last fix outside the track when it is at most 3 s away", () => {
    const late = new GpsInterpolator([fix(1500, 26.27, 73.01)]);
    expect(late.locate(0)).toEqual({ lat: 26.27, lon: 73.01, accuracy_m: 10 });
    expect(gps.locate(7000)).toEqual({ lat: 26.274, lon: 73.018, accuracy_m: 10 });
  });

  it("drops a frame whose nearest fix is stale, past the end of the track", () => {
    expect(gps.locate(7001)).toBeUndefined();
    expect(new GpsInterpolator([fix(3500, 26.27, 73.01)]).locate(0)).toBeUndefined();
  });

  it("keeps frames near either side of a gap but drops the middle of a long one", () => {
    const gappy = new GpsInterpolator([fix(0, 26.27, 73.01), fix(10_000, 26.28, 73.02)]);
    expect(gappy.locate(3000)).toEqual({ lat: 26.273, lon: 73.013, accuracy_m: 10 });
    expect(gappy.locate(5000)).toBeUndefined();
    expect(gappy.locate(7000)).toEqual({ lat: 26.277, lon: 73.017, accuracy_m: 10 });
  });

  it("drops a frame when a fix it leans on is worse than 50 m, and keeps exactly 50 m", () => {
    const fuzzy = new GpsInterpolator([fix(0, 26.27, 73.01, 50), fix(1000, 26.271, 73.011, 80), fix(2000, 26.272, 73.012, 9)]);
    expect(fuzzy.locate(0)).toEqual({ lat: 26.27, lon: 73.01, accuracy_m: 50 });
    expect(fuzzy.locate(500)).toBeUndefined();
    expect(fuzzy.locate(1000)).toBeUndefined();
    expect(fuzzy.locate(1500)).toBeUndefined();
    expect(fuzzy.locate(2000)).toEqual({ lat: 26.272, lon: 73.012, accuracy_m: 9 });
  });

  it("rounds coordinates to 6 decimals and accuracy to 0.1 m", () => {
    const odd = new GpsInterpolator([fix(0, 26.1234567, 73.7654321, 7.04), fix(3000, 26.1234568, 73.7654322, 7.06)]);
    expect(odd.locate(1000)).toEqual({ lat: 26.123457, lon: 73.765432, accuracy_m: 7.1 });
  });

  it("finds nothing on an empty track", () => {
    expect(new GpsInterpolator([]).locate(0)).toBeUndefined();
  });
});

describe("ScanSessionRules", () => {
  const rules = new ScanSessionRules();

  it("accepts the sample session", () => {
    expect(() => {
      rules.check(sampleSession());
    }).not.toThrow();
  });

  it.each([
    ["a repeated t_ms", [fix(0, 26.27, 73.01), fix(0, 26.27, 73.01)], 1000, "fix 1 does not"],
    ["a t_ms going back", [fix(0, 26.27, 73.01), fix(2000, 26.27, 73.01), fix(1000, 26.27, 73.01)], 2000, "fix 2"],
    ["under 1 fix per second", [fix(0, 26.27, 73.01), fix(4000, 26.27, 73.01)], 4000, "at least 4 fixes"],
  ])("rejects a GPS track with %s", (_case, gpsTrack, durationMs, message) => {
    const session = sampleSession({ gps_track: gpsTrack, duration_ms: durationMs });
    expect(() => {
      rules.check(session);
    }).toThrow(ValidationError);
    expect(() => {
      rules.check(session);
    }).toThrow(message);
  });

  it("accepts a single fix for a clip under one second", () => {
    expect(() => {
      rules.check(sampleSession({ gps_track: [fix(0, 26.27, 73.01)], duration_ms: 900 }));
    }).not.toThrow();
  });

  it("rejects a video key that belongs to another scan", () => {
    expect(() => {
      rules.check(sampleSession({ video_key: "scans/scn_other.webm" }));
    }).toThrow("video_key must be scans/scn_jpr_1.webm or .mp4");
  });

  it("rejects a session that ends before it starts", () => {
    expect(() => {
      rules.check(sampleSession({ ended_at: "2026-10-10T04:02:00Z" }));
    }).toThrow("ended_at must be after started_at");
  });
});
