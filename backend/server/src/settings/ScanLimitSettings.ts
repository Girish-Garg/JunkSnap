import { z } from "zod";
import type { ScanFrameRules, ScanGpsLimits, ScanLimits, ScanVideoLimits } from "../domain/scanLimits.js";
import { parseEnv, type Env } from "./utils.js";

const MEBIBYTE = 1024 * 1024;
const whole = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).default(fallback);

// Decision 20261010-0203; the api checks the presign request and the worker the real video, so both read these.
const ScanLimitEnv = z.object({
  SCAN_MAX_MB: whole(1, 1_024, 40),
  // The scan_session schema caps duration_ms at 60000.
  SCAN_MAX_SECONDS: whole(1, 60, 60),
  SCAN_MAX_LONG_SIDE_PX: whole(1, 7_680, 1_280),
  SCAN_MAX_SHORT_SIDE_PX: whole(1, 4_320, 720),
  SCAN_FRAME_INTERVAL_MS: whole(100, 60_000, 1_000),
  // The scan_session schema allows 600 hints.
  SCAN_MAX_HINT_FRAMES: whole(0, 600, 60),
  SCAN_MAX_FIX_GAP_MS: whole(1, 60_000, 3_000),
  SCAN_MAX_ACCURACY_M: whole(1, 1_000, 50),
  SCAN_MIN_FIXES_PER_SECOND: z.coerce.number().gt(0).max(10).default(1),
  // Bits of a 64-bit difference hash.
  SCAN_DUPLICATE_BITS: whole(0, 64, 5),
  SCAN_SIMILAR_BITS: whole(0, 64, 20),
  SCAN_SAME_SPOT_M: whole(0, 1_000, 10),
  SCAN_SPOT_RADIUS_M: whole(1, 1_000, 20),
});

type ScanLimitValues = z.output<typeof ScanLimitEnv>;

export class ScanLimitSettings implements ScanLimits {
  readonly video: ScanVideoLimits;
  readonly gps: ScanGpsLimits;
  readonly frames: ScanFrameRules;

  private constructor(values: ScanLimitValues) {
    this.video = Object.freeze({
      maxBytes: values.SCAN_MAX_MB * MEBIBYTE,
      maxDurationMs: values.SCAN_MAX_SECONDS * 1_000,
      maxLongSidePx: values.SCAN_MAX_LONG_SIDE_PX,
      maxShortSidePx: values.SCAN_MAX_SHORT_SIDE_PX,
    });
    this.gps = Object.freeze({
      maxFixGapMs: values.SCAN_MAX_FIX_GAP_MS,
      maxAccuracyM: values.SCAN_MAX_ACCURACY_M,
      minFixesPerSecond: values.SCAN_MIN_FIXES_PER_SECOND,
    });
    this.frames = ScanLimitSettings.#frames(values);
    Object.freeze(this);
  }

  static fromEnv(env: Env): ScanLimitSettings {
    return new ScanLimitSettings(parseEnv(ScanLimitEnv, env));
  }

  static #frames(values: ScanLimitValues): ScanFrameRules {
    return Object.freeze({
      intervalMs: values.SCAN_FRAME_INTERVAL_MS,
      maxHintFrames: values.SCAN_MAX_HINT_FRAMES,
      duplicateDistance: values.SCAN_DUPLICATE_BITS,
      sameSpotM: values.SCAN_SAME_SPOT_M,
      similarDistance: values.SCAN_SIMILAR_BITS,
      spotRadiusM: values.SCAN_SPOT_RADIUS_M,
    });
  }
}
