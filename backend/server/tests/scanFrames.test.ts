import { describe, expect, it } from "vitest";
import type { ScanDetection } from "../src/contracts/scanSessionPending.js";
import { FrameHash } from "../src/domain/FrameHash.js";
import type { CandidateFrame } from "../src/domain/ScanFrame.js";
import { ScanFrameId } from "../src/domain/ScanFrameId.js";
import { FramePlanner } from "../src/services/FramePlanner.js";
import { FrameSelector } from "../src/services/FrameSelector.js";

const BOX = { left: 0.1, top: 0.1, width: 0.2, height: 0.2 };
const GPS = { lat: 26.2918, lon: 73.0213, accuracy_m: 6 };

function hint(tMs: number, score: number): ScanDetection {
  return { t_ms: tMs, score, box: BOX };
}

function frame(tMs: number, bits: bigint, hintScore?: number): CandidateFrame {
  return { tMs, gps: GPS, path: `frame-${tMs}.jpg`, hash: new FrameHash(bits), ...(hintScore === undefined ? {} : { hintScore }) };
}

describe("FrameHash", () => {
  it("counts the bits two hashes differ in", () => {
    const zero = new FrameHash(0n);
    expect(zero.distanceTo(new FrameHash(0n))).toBe(0);
    expect(zero.distanceTo(new FrameHash(0b1011n))).toBe(3);
    expect(zero.distanceTo(new FrameHash(-1n))).toBe(64);
    expect(new FrameHash(0xabcn).toHex()).toBe("0000000000000abc");
  });
});

describe("ScanFrameId", () => {
  it("derives the same upload and report ids from the scan id and frame time", () => {
    const id = ScanFrameId.of("scn_jpr_1", 4000);
    expect(id.uploadId).toMatch(/^upl_[0-9a-f]{26}$/);
    expect(id.reportId).toBe(`rpt_${id.uploadId.slice(4)}`);
    expect(id.originalKey).toBe(`reports/${id.uploadId}.jpg`);
    expect(ScanFrameId.of("scn_jpr_1", 4000)).toEqual(id);
    expect(ScanFrameId.of("scn_jpr_1", 5000).uploadId).not.toBe(id.uploadId);
  });
});

describe("FramePlanner", () => {
  const planner = new FramePlanner();

  it("plans one frame per second of video", () => {
    expect(planner.plan(8000, []).map((planned) => planned.tMs)).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
    expect(planner.plan(2500, [])).toEqual([{ tMs: 0 }, { tMs: 1000 }, { tMs: 2000 }]);
  });

  it("adds hinted frames, replaces the plain frame at the same time and ignores hints past the end", () => {
    const plan = planner.plan(3000, [hint(1600, 0.5), hint(2000, 0.9), hint(3000, 0.99)]);
    expect(plan).toEqual([
      { tMs: 0 },
      { tMs: 1000 },
      { tMs: 1600, hintScore: 0.5 },
      { tMs: 2000, hintScore: 0.9 },
    ]);
  });

  it("keeps the strongest hint at a repeated time and at most 60 hinted frames", () => {
    expect(planner.plan(1000, [hint(500, 0.9), hint(500, 0.2)])).toContainEqual({ tMs: 500, hintScore: 0.9 });
    const many = Array.from({ length: 200 }, (_value, i) => hint(i * 250 + 1, i / 200));
    const hinted = planner.plan(60_000, many).filter((planned) => planned.hintScore !== undefined);
    expect(hinted).toHaveLength(60);
    expect(Math.min(...hinted.map((planned) => planned.hintScore ?? 0))).toBe(140 / 200);
  });
});

describe("FrameSelector", () => {
  const selector = new FrameSelector();
  const far = (n: number): bigint => BigInt(n) * 0x9e3779b97f4a7c15n;

  it("keeps at most one frame per second, preferring the strongest hint over a plain frame", () => {
    const kept = selector.select([
      frame(1000, far(1)),
      frame(1400, far(2), 0.4),
      frame(1700, far(3), 0.8),
      frame(2000, far(4)),
      frame(2999, far(5)),
    ]);
    expect(kept.map((chosen) => chosen.tMs)).toEqual([1700, 2000]);
  });

  it("skips a frame that repeats the last kept view and compares later frames with that kept one", () => {
    const base = 0xf0f0f0f0f0f0f0f0n;
    const kept = selector.select([
      frame(0, base),
      frame(1000, base ^ 0b11111n),
      frame(2000, base ^ 0b111111n),
      frame(3000, far(9)),
    ]);
    expect(kept.map((chosen) => chosen.tMs)).toEqual([0, 2000, 3000]);
  });

  it("sorts frames by time before choosing", () => {
    const kept = selector.select([frame(3000, far(3)), frame(0, far(1)), frame(1000, far(2))]);
    expect(kept.map((chosen) => chosen.tMs)).toEqual([0, 1000, 3000]);
  });

  it("takes the duplicate threshold from its constructor", () => {
    const strict = new FrameSelector(0);
    expect(strict.select([frame(0, 0n), frame(1000, 1n)])).toHaveLength(2);
    expect(strict.select([frame(0, 0n), frame(1000, 0n)])).toHaveLength(1);
  });
});
