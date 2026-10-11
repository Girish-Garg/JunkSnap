// The scan limits in contracts/README.md (Scan video, Scan frames); ScanLimitSettings reads each from its variable.
export interface ScanVideoLimits {
  readonly maxBytes: number;
  readonly maxDurationMs: number;
  readonly maxLongSidePx: number;
  readonly maxShortSidePx: number;
}

export interface ScanGpsLimits {
  // A frame needs a fix this close in time, and an interpolated position this accurate.
  readonly maxFixGapMs: number;
  readonly maxAccuracyM: number;
  readonly minFixesPerSecond: number;
}

export interface ScanFrameRules {
  readonly intervalMs: number;
  readonly maxHintFrames: number;
  // Difference-hash bits two frames may differ by and still count as the same view.
  readonly duplicateDistance: number;
  // Two frames within this many metres whose hashes differ by at most similarDistance show the same spot.
  readonly sameSpotM: number;
  readonly similarDistance: number;
  // Kept frames within this radius of a spot's first frame merge into one site per type.
  readonly spotRadiusM: number;
}

export interface ScanLimits {
  readonly video: ScanVideoLimits;
  readonly gps: ScanGpsLimits;
  readonly frames: ScanFrameRules;
}
