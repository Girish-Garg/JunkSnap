/// <reference types="vite/client" />

/**
 * The VITE_ variables Vite bakes into the bundle at build time. They are public: never put a secret in one.
 * Only src/app/AppConfig.ts reads them (AppConfig.fromBuild); defaults and meanings are in frontend/.env.example.
 */
interface ImportMetaEnv {
  // Endpoints and sign-in (contracts/README.md)
  readonly VITE_API_URL?: string;
  readonly VITE_API_MODE?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_WEB_URL?: string;

  // Site rules mirrored from the api (src/config/SiteRules.ts)
  readonly VITE_VOTE_RADIUS_M?: string;
  readonly VITE_FLAG_RADIUS_M?: string;
  readonly VITE_CLEANUP_RADIUS_M?: string;
  readonly VITE_DISTANCE_MARGIN_M?: string;
  readonly VITE_TARGET_GROUND_MAX_M?: string;
  readonly VITE_TARGET_MAX_M?: string;
  readonly VITE_TARGET_MARGIN_M?: string;
  readonly VITE_TARGET_HERE_M?: string;
  readonly VITE_SITE_MERGE_RADIUS_M?: string;
  readonly VITE_ZONE_RADIUS_M?: string;
  readonly VITE_MIN_VERIFIED_REPORTS?: string;

  // Map (src/config/MapSettings.ts)
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_BOUNDARIES_PATH?: string;
  readonly VITE_PILOT_CENTRE?: string;
  readonly VITE_PILOT_BOUNDS?: string;
  readonly VITE_PILOT_ZOOM?: string;
  readonly VITE_MAP_SITE_ZOOM?: string;
  readonly VITE_MAP_MIN_ZOOM?: string;
  readonly VITE_MAP_MAX_BOUNDS?: string;
  readonly VITE_MAP_MAX_ZOOM?: string;
  readonly VITE_TARGET_MAP_ZOOM?: string;
  readonly VITE_THIN_MAX?: string;
  readonly VITE_SITE_TILE_DEG?: string;
  readonly VITE_SITE_TILES_PER_SIDE?: string;
  readonly VITE_MAP_FIT_PADDING_PX?: string;
  readonly VITE_MAP_FIT_TIGHT_PX?: string;
  readonly VITE_MAP_FIT_MIN_FREE?: string;
  readonly VITE_MAP_FLASH_MS?: string;

  // Capture (src/config/CaptureSettings.ts)
  readonly VITE_CAPTURE_FIX_MAX_AGE_MS?: string;
  readonly VITE_STALE_FIX_FALLBACK_MS?: string;
  readonly VITE_GPS_MAX_AGE_MS?: string;
  readonly VITE_GPS_TIMEOUT_MS?: string;
  readonly VITE_CURRENT_FIX_MAX_AGE_MS?: string;
  readonly VITE_CURRENT_FIX_TIMEOUT_MS?: string;
  readonly VITE_LOCATE_MAX_AGE_MS?: string;
  readonly VITE_LOCATE_TIMEOUT_MS?: string;
  readonly VITE_FRESH_FIX_MS?: string;
  readonly VITE_SCAN_MAX_DURATION_MS?: string;
  readonly VITE_SCAN_MAX_BYTES?: string;
  readonly VITE_SCAN_VIDEO_BITS_PER_SECOND?: string;
  readonly VITE_PHOTO_MAX_EDGE_PX?: string;
  readonly VITE_PHOTO_JPEG_QUALITY?: string;
  readonly VITE_EDGE_HINT_INTERVAL_MS?: string;
  readonly VITE_SCAN_HINT_MIN_SCORE?: string;
  readonly VITE_EDGE_OVERLAY_MIN_SCORE?: string;
  readonly VITE_EDGE_OVERLAY_MAX_BOXES?: string;
  readonly VITE_EDGE_SPOTTED_FRAMES?: string;
  readonly VITE_EDGE_WARMUP_BUDGET_MS?: string;
  readonly VITE_EDGE_MIN_MEMORY_GB?: string;
  readonly VITE_CAMERA_STALL_MS?: string;
  readonly VITE_CAMERA_CHECK_MS?: string;
  readonly VITE_CAMERA_MAX_RESTARTS?: string;

  // Network (src/config/NetworkSettings.ts)
  readonly VITE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_PUT_BASE_TIMEOUT_MS?: string;
  readonly VITE_PUT_MS_PER_CHUNK?: string;
  readonly VITE_PUT_CHUNK_BYTES?: string;
  readonly VITE_PUT_MAX_TIMEOUT_MS?: string;
  readonly VITE_RETRY_OFFLINE_MS?: string;
  readonly VITE_RETRY_RATE_LIMITED_MS?: string;
  readonly VITE_RETRY_FIRST_MS?: string;
  readonly VITE_RETRY_MAX_MS?: string;
  readonly VITE_PRESIGN_REUSE_MS?: string;
  readonly VITE_MOCK_DELAY_MS?: string;

  // Caches and refresh (src/config/CacheSettings.ts)
  readonly VITE_AREA_CACHE_TTL_MS?: string;
  readonly VITE_AREA_CACHE_ENTRIES?: string;
  readonly VITE_BOUNDARY_INDEX_TTL_MS?: string;
  readonly VITE_SITE_CACHE_TILES?: string;
  readonly VITE_SITE_CACHE_SITES?: string;
  readonly VITE_ACTIVITY_TTL_MS?: string;
  readonly VITE_ACTIVITY_SYNC_MS?: string;
  readonly VITE_REPORT_POLL_MS?: string;
  readonly VITE_SCAN_POLL_MS?: string;
  readonly VITE_CLEANUP_POLL_MS?: string;
  readonly VITE_FEEDBACK_POLL_MS?: string;

  // UI timing (src/config/UiTimings.ts)
  readonly VITE_TOAST_MS?: string;
  readonly VITE_CONFIRM_TOAST_MS?: string;
  readonly VITE_REJECTION_TOAST_MS?: string;
  readonly VITE_COPIED_MS?: string;
  readonly VITE_RATE_LIMIT_COOLDOWN_MS?: string;
  readonly VITE_CLOCK_TICK_MS?: string;
  readonly VITE_SPLASH_FLY_MS?: string;
  readonly VITE_SPLASH_STILL_MS?: string;

  // Limits (src/config/ListLimits.ts)
  readonly VITE_MAILTO_MAX_LENGTH?: string;
  readonly VITE_SEARCH_RESULTS?: string;
  readonly VITE_LIST_PAGE_SIZE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
