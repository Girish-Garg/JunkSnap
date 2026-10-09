import type { PlannedFrame, ScanDetection } from "../domain/ScanFrame.js";
import { SCAN_FRAME_RULES } from "../domain/scanLimits.js";

// One plain frame per second plus the strongest phone-hinted moments; hints only steer frame choice.
export class FramePlanner {
  plan(durationMs: number, detections: readonly ScanDetection[]): PlannedFrame[] {
    const frames = new Map<number, PlannedFrame>();
    for (let tMs = 0; tMs < durationMs; tMs += SCAN_FRAME_RULES.intervalMs) {
      frames.set(tMs, { tMs });
    }
    for (const hint of FramePlanner.#strongestLast(detections, durationMs)) {
      frames.set(hint.t_ms, { tMs: hint.t_ms, hintScore: hint.score });
    }
    return [...frames.values()].sort((a, b) => a.tMs - b.tMs);
  }

  // Weakest first, so the strongest hint at a repeated t_ms is written last and wins.
  static #strongestLast(detections: readonly ScanDetection[], durationMs: number): ScanDetection[] {
    return detections
      .filter((hint) => hint.t_ms < durationMs)
      .toSorted((a, b) => a.score - b.score)
      .slice(-SCAN_FRAME_RULES.maxHintFrames);
  }
}
