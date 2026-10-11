import { EnvReader } from './EnvReader';
import type { EnvVars } from './EnvVar';
import { Vars } from './Vars';

/** GPS freshness and the start-up fix, Snap and Scan limits, the on-phone hints and the camera watchdog. */
export interface CaptureSettings {
  /** Snap, Scan, No bin and cleanup refuse a fix already older than this when it arrives. */
  readonly fixMaxAgeMs: number;
  /** After this long with only refused fixes (a phone clock off from the GPS's), the newest is used anyway. */
  readonly staleFixFallbackMs: number;
  /** watchPosition maximumAge while the camera is open; keep it well under fixMaxAgeMs. */
  readonly gpsMaxAgeMs: number;
  /** watchPosition timeout; a timeout just keeps waiting. */
  readonly gpsTimeoutMs: number;
  /** One fresh fix for a vote or an action: getCurrentPosition maximumAge and timeout. */
  readonly currentFixMaxAgeMs: number;
  readonly currentFixTimeoutMs: number;
  /** The map's "where am I" fix: getCurrentPosition maximumAge and timeout. */
  readonly locateMaxAgeMs: number;
  readonly locateTimeoutMs: number;
  /** Distance rules (vote, cleanup, add a photo) trust the map's fix for this long. */
  readonly freshFixMs: number;
  /**
   * One fix per launch after the splash and the first-run cards: quiet if allowed, the ask if undecided and never
   * refused, none if blocked.
   */
  readonly askLocationAtStart: boolean;
  /** A Scan stops at this length (api scan video limit; the scan_session schema allows at most 60 s). */
  readonly scanMaxDurationMs: number;
  /** A Scan stops before this size (api scan video limit, 400 scan_too_large). */
  readonly scanMaxBytes: number;
  /** Scan video bit rate: 2.5 Mbit/s makes a full minute about 19 MB. */
  readonly scanVideoBitsPerSecond: number;
  /** A photo's longest side; the api takes photos up to 8 MB. */
  readonly photoMaxEdgePx: number;
  readonly photoJpegQuality: number;
  /** How often the on-phone detector looks at the viewfinder (250 ms is about 4 frames a second). */
  readonly hintIntervalMs: number;
  /** A Scan frame is sent as a hint only when the detector is at least this sure there is waste. */
  readonly hintMinScore: number;
  /** Live boxes below this score are not drawn. */
  readonly overlayMinScore: number;
  /** At most this many live boxes, strongest first. */
  readonly overlayMaxBoxes: number;
  /** Frames in a row with a waste box before the hint says "Waste spotted". */
  readonly spottedFrames: number;
  /** A warm inference slower than this keeps the app in cloud mode (the edge probe). */
  readonly warmupBudgetMs: number;
  /** Below this much memory (GB) the phone keeps cloud mode. */
  readonly minMemoryGb: number;
  /** A visible viewfinder with no new frame for this long is frozen and opened again. */
  readonly cameraStallMs: number;
  /** How often the camera watchdog looks. */
  readonly cameraCheckMs: number;
  /** Restarts in a row without a frame before the camera help (Try again) shows. */
  readonly cameraMaxRestarts: number;
}

const MINUTE_MS = 60_000;
const SCHEMA_MAX_DURATION_MS = 60_000;

export const CAPTURE_VARS: EnvVars<CaptureSettings> = {
  fixMaxAgeMs: Vars.ms('VITE_CAPTURE_FIX_MAX_AGE_MS', 10_000, MINUTE_MS),
  staleFixFallbackMs: Vars.ms('VITE_STALE_FIX_FALLBACK_MS', 15_000, MINUTE_MS),
  gpsMaxAgeMs: Vars.number('VITE_GPS_MAX_AGE_MS', 5_000, { min: 0, max: MINUTE_MS, integer: true }),
  gpsTimeoutMs: Vars.ms('VITE_GPS_TIMEOUT_MS', 30_000, 5 * MINUTE_MS),
  currentFixMaxAgeMs: Vars.number('VITE_CURRENT_FIX_MAX_AGE_MS', 10_000, { min: 0, max: MINUTE_MS, integer: true }),
  currentFixTimeoutMs: Vars.ms('VITE_CURRENT_FIX_TIMEOUT_MS', 20_000, 5 * MINUTE_MS),
  locateMaxAgeMs: Vars.number('VITE_LOCATE_MAX_AGE_MS', 60_000, { min: 0, max: 30 * MINUTE_MS, integer: true }),
  locateTimeoutMs: Vars.ms('VITE_LOCATE_TIMEOUT_MS', 10_000, 5 * MINUTE_MS),
  freshFixMs: Vars.ms('VITE_FRESH_FIX_MS', 120_000, 30 * MINUTE_MS),
  askLocationAtStart: Vars.flag('VITE_ASK_LOCATION_AT_START', true),
  scanMaxDurationMs: Vars.number('VITE_SCAN_MAX_DURATION_MS', 60_000, { min: 5_000, max: SCHEMA_MAX_DURATION_MS, integer: true }),
  scanMaxBytes: Vars.count('VITE_SCAN_MAX_BYTES', 40 * 1024 * 1024, 1024 * 1024 * 1024, 4 * 1024 * 1024),
  scanVideoBitsPerSecond: Vars.count('VITE_SCAN_VIDEO_BITS_PER_SECOND', 2_500_000, 20_000_000, 100_000),
  photoMaxEdgePx: Vars.count('VITE_PHOTO_MAX_EDGE_PX', 2048, 8192, 320),
  photoJpegQuality: Vars.number('VITE_PHOTO_JPEG_QUALITY', 0.85, { min: 0.1, max: 1 }),
  hintIntervalMs: Vars.ms('VITE_EDGE_HINT_INTERVAL_MS', 250, 10_000),
  hintMinScore: Vars.fraction('VITE_SCAN_HINT_MIN_SCORE', 0.35),
  overlayMinScore: Vars.fraction('VITE_EDGE_OVERLAY_MIN_SCORE', 0.5),
  overlayMaxBoxes: Vars.count('VITE_EDGE_OVERLAY_MAX_BOXES', 8, 100),
  spottedFrames: Vars.count('VITE_EDGE_SPOTTED_FRAMES', 2, 100),
  warmupBudgetMs: Vars.ms('VITE_EDGE_WARMUP_BUDGET_MS', 150, 10_000),
  minMemoryGb: Vars.number('VITE_EDGE_MIN_MEMORY_GB', 2, { min: 0, max: 64 }),
  cameraStallMs: Vars.ms('VITE_CAMERA_STALL_MS', 2_000, MINUTE_MS),
  cameraCheckMs: Vars.ms('VITE_CAMERA_CHECK_MS', 500, MINUTE_MS),
  cameraMaxRestarts: Vars.count('VITE_CAMERA_MAX_RESTARTS', 5, 100),
};

export const CAPTURE_DEFAULTS: CaptureSettings = EnvReader.defaults(CAPTURE_VARS);
