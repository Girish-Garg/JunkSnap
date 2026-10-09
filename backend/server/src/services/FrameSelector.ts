import type { CandidateFrame } from "../domain/ScanFrame.js";
import { SCAN_FRAME_RULES } from "../domain/scanLimits.js";

const NO_HINT = -1;

// At most one frame per second (a hinted frame beats a plain one), then drops views that repeat the last kept frame.
export class FrameSelector {
  readonly #duplicateDistance: number;

  constructor(duplicateDistance: number = SCAN_FRAME_RULES.duplicateDistance) {
    this.#duplicateDistance = duplicateDistance;
  }

  select<T extends CandidateFrame>(frames: readonly T[]): T[] {
    const kept: T[] = [];
    for (const frame of FrameSelector.#bestPerSecond(frames)) {
      const last = kept.at(-1);
      if (last === undefined || last.hash.distanceTo(frame.hash) > this.#duplicateDistance) {
        kept.push(frame);
      }
    }
    return kept;
  }

  static #bestPerSecond<T extends CandidateFrame>(frames: readonly T[]): T[] {
    const best = new Map<number, T>();
    for (const frame of frames.toSorted((a, b) => a.tMs - b.tMs)) {
      const second = Math.floor(frame.tMs / SCAN_FRAME_RULES.intervalMs);
      const current = best.get(second);
      if (current === undefined || FrameSelector.#rank(frame) > FrameSelector.#rank(current)) {
        best.set(second, frame);
      }
    }
    return [...best.values()].sort((a, b) => a.tMs - b.tMs);
  }

  static #rank(frame: CandidateFrame): number {
    return frame.hintScore ?? NO_HINT;
  }
}
