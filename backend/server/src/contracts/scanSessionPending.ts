// Mirrors scan_session from the coming contracts PR #39; swap for scan_session.gen.ts once it merges.
import { ContractValidator } from "./ContractValidator.js";
import type { ReportUpload } from "./index.gen.js";

export interface GpsFix {
  t_ms: number;
  lat: number;
  lon: number;
  accuracy_m: number;
  speed_mps?: number | null;
  heading?: number | null;
}

export interface ScanDetection {
  t_ms: number;
  score: number;
  box: { left: number; top: number; width: number; height: number };
}

export interface ScanSession {
  scan_id: string;
  device_token: string;
  user_id?: string;
  report_type: ReportUpload["report_type"];
  context: ReportUpload["context"];
  started_at: string;
  ended_at: string;
  duration_ms: number;
  video_key: string;
  video_sha256: string;
  gps_track: GpsFix[];
  hints?: { model: string; detections: ScanDetection[] };
}

// report_upload as PR #39 extends it for frames the worker cuts from a scan.
export type ScanFrameUpload = ReportUpload & {
  scan: { scan_id: string; t_ms: number };
  user_id?: string;
};

const TIME_MS = { type: "integer", minimum: 0, maximum: 60000 };
const FRACTION = { type: "number", minimum: 0, maximum: 1 };
const REPORT_TYPES = ["waste_dump", "no_bin", "contaminated_water", "open_construction"];
const CONTEXTS = [
  "vacant_plot", "roadside", "drain", "other", "no_bin", "no_pickup",
  "stagnant", "sewage", "foam", "choked_drain", "uncovered_debris", "dusty_site",
];
const CONTEXTS_BY_TYPE: Record<string, string[]> = {
  waste_dump: ["vacant_plot", "roadside", "drain", "other"],
  no_bin: ["no_bin", "no_pickup"],
  contaminated_water: ["stagnant", "sewage", "foam", "choked_drain"],
  open_construction: ["uncovered_debris", "dusty_site"],
};

const gpsFixSchema = {
  type: "object",
  additionalProperties: false,
  required: ["t_ms", "lat", "lon", "accuracy_m"],
  properties: {
    t_ms: TIME_MS,
    lat: { type: "number", minimum: -90, maximum: 90 },
    lon: { type: "number", minimum: -180, maximum: 180 },
    accuracy_m: { type: "number", minimum: 0 },
    speed_mps: { type: ["number", "null"], minimum: 0 },
    heading: { type: ["number", "null"], minimum: 0, maximum: 360 },
  },
};

const detectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["t_ms", "score", "box"],
  properties: {
    t_ms: TIME_MS,
    score: FRACTION,
    box: {
      type: "object",
      additionalProperties: false,
      required: ["left", "top", "width", "height"],
      properties: { left: FRACTION, top: FRACTION, width: FRACTION, height: FRACTION },
    },
  },
};

export const scanSessionSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "scan_session",
  type: "object",
  additionalProperties: false,
  required: [
    "scan_id", "device_token", "report_type", "context", "started_at", "ended_at",
    "duration_ms", "video_key", "video_sha256", "gps_track",
  ],
  properties: {
    scan_id: { type: "string", pattern: "^scn_[a-z0-9_]{1,40}$" },
    device_token: {
      type: "string",
      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    },
    user_id: { type: "string", pattern: "^[A-Za-z0-9-]{1,128}$" },
    report_type: { enum: REPORT_TYPES },
    context: { enum: CONTEXTS },
    started_at: { type: "string", format: "date-time" },
    ended_at: { type: "string", format: "date-time" },
    duration_ms: { type: "integer", minimum: 1, maximum: 60000 },
    video_key: { type: "string", pattern: "^scans/scn_[a-z0-9_]{1,40}\\.(webm|mp4)$" },
    video_sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
    gps_track: { type: "array", minItems: 1, maxItems: 600, items: gpsFixSchema },
    hints: {
      type: "object",
      additionalProperties: false,
      required: ["model", "detections"],
      properties: {
        model: { type: "string" },
        detections: { type: "array", maxItems: 600, items: detectionSchema },
      },
    },
  },
  allOf: Object.entries(CONTEXTS_BY_TYPE).map(([reportType, contexts]) => ({
    if: { properties: { report_type: { const: reportType } } },
    then: { properties: { context: { enum: contexts } } },
  })),
};

const validator = new ContractValidator<ScanSession>("scan_session", scanSessionSchema);

export function validateScanSession(value: unknown): ScanSession {
  return validator.validate(value);
}
