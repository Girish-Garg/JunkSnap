import { EDGE_CLASSES, type Detection } from './EdgeModel';
import type { Letterbox } from './Letterbox';

/** Values per row of the end-to-end YOLO26 output [1, 300, 6]: x1, y1, x2, y2, score, class. */
export const ROW_SIZE = 6;

/** Decodes the NMS-free model output (already filtered by the worker) into frame-fraction detections. */
export class EdgeOutput {
  static decode(rows: ArrayLike<number>, letterbox: Letterbox, minScore: number): Detection[] {
    const found: Detection[] = [];
    for (let at = 0; at + ROW_SIZE <= rows.length; at += ROW_SIZE) {
      const detection = EdgeOutput.#row(rows, at, letterbox);
      if (detection && detection.score >= minScore) found.push(detection);
    }
    return found.sort((a, b) => b.score - a.score);
  }

  /** Keeps only rows at or above minScore, flattened; the worker sends these to the page. */
  static keep(output: ArrayLike<number>, minScore: number): number[] {
    const kept: number[] = [];
    for (let at = 0; at + ROW_SIZE <= output.length; at += ROW_SIZE) {
      if ((output[at + 4] ?? 0) >= minScore) kept.push(...Array.from({ length: ROW_SIZE }, (_, i) => output[at + i] ?? 0));
    }
    return kept;
  }

  static #row(rows: ArrayLike<number>, at: number, letterbox: Letterbox): Detection | null {
    const value = (offset: number) => rows[at + offset] ?? 0;
    const label = EDGE_CLASSES[Math.round(value(5))];
    if (!label) return null;
    const box = letterbox.toFraction(value(0), value(1), value(2), value(3));
    if (box.width <= 0 || box.height <= 0) return null;
    return { label, score: value(4), box };
  }
}
