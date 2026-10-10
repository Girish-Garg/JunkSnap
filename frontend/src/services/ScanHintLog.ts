import { WASTE_CLASSES, type FrameDetections } from '../domain/EdgeModel';
import { SCAN_LIMITS, type ScanHintDetection, type ScanHints } from '../domain/ScanUpload';

/** A frame counts as a hint only when the model is at least this sure there is waste. */
export const HINT_MIN_SCORE = 0.35;
const MAX_HINTS = 600;
// Three decimals keep the body small; the server only uses the time and the score.
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * The strongest waste box of each analysed frame during a Scan, timed from the start of the video.
 * Sent as scan_session.hints so the server picks those moments; it never trusts them as evidence.
 */
export class ScanHintLog {
  readonly #model: string;
  readonly #items: ScanHintDetection[] = [];
  #startedAtMs: number | null = null;

  constructor(model: string) {
    this.#model = model;
  }

  begin(startedAtMs: number): void {
    this.#startedAtMs = startedAtMs;
  }

  add(frame: FrameDetections): void {
    if (this.#startedAtMs === null) return;
    const tMs = Math.round(frame.capturedAtMs - this.#startedAtMs);
    const best = frame.detections.find((found) => WASTE_CLASSES.has(found.label) && found.score >= HINT_MIN_SCORE);
    if (!best || tMs < 0 || tMs > SCAN_LIMITS.maxDurationMs) return;
    const { left, top, width, height } = best.box;
    this.#items.push({ t_ms: tMs, score: round(best.score), box: { left: round(left), top: round(top), width: round(width), height: round(height) } });
  }

  /** The hints for a video of this length, or null when nothing was spotted. */
  hints(durationMs: number): ScanHints | null {
    const inside = this.#items.filter((item) => item.t_ms < durationMs);
    if (inside.length === 0) return null;
    const strongest = inside.toSorted((a, b) => b.score - a.score).slice(0, MAX_HINTS);
    return { model: this.#model, detections: strongest.toSorted((a, b) => a.t_ms - b.t_ms) };
  }
}
