import type { PlannedFrame, ScanDetection } from "../domain/ScanFrame.js";
import type { ScanFrameRules } from "../domain/scanLimits.js";

// One plain frame per interval (SCAN_FRAME_INTERVAL_MS) plus the strongest phone-hinted moments; hints only steer frame choice.
export class FramePlanner {
  readonly #rules: Pick<ScanFrameRules, "intervalMs" | "maxHintFrames">;

  constructor(rules: Pick<ScanFrameRules, "intervalMs" | "maxHintFrames">) {
    this.#rules = rules;
  }

  plan(durationMs: number, detections: readonly ScanDetection[]): PlannedFrame[] {
    const frames = new Map<number, PlannedFrame>();
    for (let tMs = 0; tMs < durationMs; tMs += this.#rules.intervalMs) {
      frames.set(tMs, { tMs });
    }
    for (const hint of this.#strongestLast(detections, durationMs)) {
      frames.set(hint.t_ms, { tMs: hint.t_ms, hintScore: hint.score });
    }
    return [...frames.values()].sort((a, b) => a.tMs - b.tMs);
  }

  // Weakest first, so the strongest hint at a repeated t_ms is written last and wins.
  // slice(-0) would keep every hint, so SCAN_MAX_HINT_FRAMES=0 counts from the front.
  #strongestLast(detections: readonly ScanDetection[], durationMs: number): ScanDetection[] {
    const hints = detections.filter((hint) => hint.t_ms < durationMs).toSorted((a, b) => a.score - b.score);
    return hints.slice(Math.max(0, hints.length - this.#rules.maxHintFrames));
  }
}
