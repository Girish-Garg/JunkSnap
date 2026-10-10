import { GeoPoint } from "../domain/GeoPoint.js";
import type { CandidateFrame } from "../domain/ScanFrame.js";
import { SCAN_FRAME_RULES } from "../domain/scanLimits.js";

const NO_HINT = -1;

export interface SelectorRules {
  readonly duplicateDistance: number;
  readonly sameSpotM: number;
  readonly similarDistance: number;
}

// At most one frame per second (a hinted frame beats a plain one), then one frame per view: a repeat of the last
// kept frame, or a similar view within sameSpotM of any kept frame, is dropped (the better ranked of the two stays).
export class FrameSelector {
  readonly #rules: SelectorRules;

  constructor(rules: SelectorRules = SCAN_FRAME_RULES) {
    this.#rules = rules;
  }

  select<T extends CandidateFrame>(frames: readonly T[]): T[] {
    const kept: T[] = [];
    for (const frame of FrameSelector.#bestPerSecond(frames)) {
      const last = kept.at(-1);
      if (last !== undefined && last.hash.distanceTo(frame.hash) <= this.#rules.duplicateDistance) {
        continue;
      }
      const twin = kept.findIndex((other) => this.#sameSpot(other, frame));
      if (twin === -1) {
        kept.push(frame);
      } else if (FrameSelector.#rank(frame) > FrameSelector.#rank(kept[twin] ?? frame)) {
        // Drop the twin and append, so kept stays in time order and at(-1) is the latest kept view.
        kept.splice(twin, 1);
        kept.push(frame);
      }
    }
    return kept;
  }

  #sameSpot(a: CandidateFrame, b: CandidateFrame): boolean {
    const metres = new GeoPoint(a.gps.lat, a.gps.lon).distanceTo(new GeoPoint(b.gps.lat, b.gps.lon));
    return metres <= this.#rules.sameSpotM && a.hash.distanceTo(b.hash) <= this.#rules.similarDistance;
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
