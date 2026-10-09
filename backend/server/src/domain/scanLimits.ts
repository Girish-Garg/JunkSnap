// About 60 s of 720p; the contracts PR #25 draft says 40 MB, so keep the two in step when it merges.
export const SCAN_VIDEO_LIMITS = {
  maxBytes: 60 * 1024 * 1024,
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
