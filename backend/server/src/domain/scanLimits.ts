// The scan video limit in contracts/README.md: at most 40 MB, 60 s and 1280 by 720.
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
  // Two frames within this many metres whose hashes differ by at most similarDistance show the same spot.
  sameSpotM: 10,
  similarDistance: 20,
  // Kept frames within this radius of a spot's first frame merge into one site per type (diameter 40 m, the merge radius).
  spotRadiusM: 20,
} as const;
