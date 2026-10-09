// The scan video limit from contracts PR #39: at most 40 MB, 60 s and 1280 by 720.
export const SCAN_VIDEO_LIMITS = {
  maxBytes: 40 * 1024 * 1024,
  maxDurationMs: 60_000,
  maxLongSidePx: 1280,
  maxShortSidePx: 720,
} as const;

export const SCAN_GPS_LIMITS = {
  maxFixGapMs: 3_000,
  maxAccuracyM: 50,
  minFixesPerSecond: 1,
} as const;

export const SCAN_FRAME_RULES = {
  intervalMs: 1_000,
  maxHintFrames: 60,
  // Difference-hash bits two frames may differ by and still count as the same view.
  duplicateDistance: 5,
} as const;
