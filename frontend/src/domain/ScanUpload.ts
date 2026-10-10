// Mirrors contracts/schemas/scan_session.schema.json and the scan bodies in contracts/README.md.
import type { BoxFraction } from './EdgeModel';
import type { ReportType } from './ReportType';
import type { SiteContext } from './Site';

/** The scan video limit (contracts/README.md Limits): 60 s, 1280 by 720, 40 MB. */
export const SCAN_LIMITS = {
  maxBytes: 40 * 1024 * 1024,
  maxDurationMs: 60_000,
  minDurationMs: 1_000,
  maxFixes: 600,
} as const;

export type VideoType = 'video/webm' | 'video/mp4';

export const VIDEO_EXTENSIONS: Readonly<Record<VideoType, string>> = { 'video/webm': 'webm', 'video/mp4': 'mp4' };

/** One gps_track item: t_ms from the start of the video. */
export interface TrackFix {
  readonly t_ms: number;
  readonly lat: number;
  readonly lon: number;
  readonly accuracy_m: number;
}

/** One scan_session.hints item: an on-phone waste box at t_ms, in frame fractions. */
export interface ScanHintDetection {
  readonly t_ms: number;
  readonly score: number;
  readonly box: BoxFraction;
}

/** On-phone detections, sent only in edge mode; they steer frame choice and are never evidence. */
export interface ScanHints {
  readonly model: string;
  readonly detections: readonly ScanHintDetection[];
}

/** auto (contracts v1.10): the models name the type (an area scout) or only the place, frame by frame. */
export const AUTO = 'auto';
export type ScanType = ReportType | typeof AUTO;
export type ScanPlace = SiteContext | typeof AUTO;

/** One finished recording, before it has a scan_id. */
export interface ScanDraft {
  readonly report_type: ScanType;
  readonly context: ScanPlace;
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_ms: number;
  readonly content_type: VideoType;
  readonly video_sha256: string;
  readonly size_bytes: number;
  readonly gps_track: readonly TrackFix[];
  /** Absent in cloud mode, so the body is exactly what it was without a model. */
  readonly hints?: ScanHints;
}

export interface ScanPresignRequest {
  readonly content_type: VideoType;
  readonly sha256: string;
  readonly size_bytes: number;
  readonly duration_ms: number;
  readonly device_token: string;
}

export interface ScanPresignResponse {
  readonly scan_id: string;
  readonly upload_url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expires_at: string;
}

/** Body of POST /scans. user_id comes from the token, never the body. */
export interface ScanSession {
  readonly scan_id: string;
  readonly device_token: string;
  readonly report_type: ScanType;
  readonly context: ScanPlace;
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_ms: number;
  readonly video_key: string;
  readonly video_sha256: string;
  readonly gps_track: readonly TrackFix[];
  readonly hints?: ScanHints;
}

export interface AcceptedScan {
  readonly scan_id: string;
  readonly status: ScanStatus;
}

export type ScanStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface ScanFrames {
  readonly sampled: number;
  readonly kept: number;
  readonly dropped_no_fix: number;
}

/** added: in a verified site; waiting: on the map, waiting for neighbours; skipped: a repeat view or a photo moderation stopped. */
export type FrameResult = 'checking' | 'added' | 'waiting' | 'not_waste' | 'skipped' | 'hidden' | 'failed' | 'withdrawn';

/** One frame of a scan and what became of it. */
export interface FrameFinding {
  readonly report_id: string;
  readonly t_ms: number;
  readonly result: FrameResult;
  readonly report_type: ReportType;
  readonly site_id: string | null;
  /** The public blurred copy; null when moderation stopped the frame. */
  readonly blurred_url: string | null;
}

/** GET /scans/{id} found: only frames the models passed count, and each site once. */
export interface ScanFound {
  readonly sites: number;
  readonly by_type: Readonly<Partial<Record<ReportType, number>>>;
  readonly checking: number;
  readonly frames: readonly FrameFinding[];
}

/** GET /scans/{id}, the fields the app reads. */
export interface ScanStatusView {
  readonly scan_id: string;
  readonly status: ScanStatus;
  readonly reason: string | null;
  readonly frames: ScanFrames | null;
  readonly report_ids: readonly string[];
  /** Null until the worker is done cutting frames; absent from an older api. */
  readonly found?: ScanFound | null;
  readonly updated_at: string;
}
