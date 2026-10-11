import type { FramePosition, GpsFix } from "../domain/ScanFrame.js";
import type { ScanGpsLimits } from "../domain/scanLimits.js";

const DEGREE_STEPS = 1e6;
const METRE_STEPS = 10;

export class GpsInterpolator {
  readonly #track: readonly GpsFix[];
  readonly #limits: Pick<ScanGpsLimits, "maxFixGapMs" | "maxAccuracyM">;

  // The track is oldest first with strictly increasing t_ms, as ScanSessionRules checks.
  constructor(track: readonly GpsFix[], limits: Pick<ScanGpsLimits, "maxFixGapMs" | "maxAccuracyM">) {
    this.#track = track;
    this.#limits = limits;
  }

  // Undefined when the nearest fix is over SCAN_MAX_FIX_GAP_MS away or the position is worse than SCAN_MAX_ACCURACY_M.
  locate(tMs: number): FramePosition | undefined {
    const nextIndex = this.#track.findIndex((fix) => fix.t_ms >= tMs);
    const after = nextIndex === -1 ? undefined : this.#track[nextIndex];
    const before = nextIndex === -1 ? this.#track.at(-1) : this.#track[nextIndex - 1];
    if (GpsInterpolator.#nearestGapMs(tMs, before, after) > this.#limits.maxFixGapMs) {
      return undefined;
    }
    const position = GpsInterpolator.#blend(tMs, before, after);
    return position !== undefined && position.accuracy_m <= this.#limits.maxAccuracyM ? position : undefined;
  }

  static #nearestGapMs(tMs: number, before?: GpsFix, after?: GpsFix): number {
    const gaps = [before, after].flatMap((fix) => (fix === undefined ? [] : [Math.abs(tMs - fix.t_ms)]));
    return Math.min(Number.POSITIVE_INFINITY, ...gaps);
  }

  static #blend(tMs: number, before?: GpsFix, after?: GpsFix): FramePosition | undefined {
    if (after !== undefined && (after.t_ms === tMs || before === undefined)) {
      return GpsInterpolator.#position(after.lat, after.lon, after.accuracy_m);
    }
    if (before === undefined || after === undefined) {
      return before && GpsInterpolator.#position(before.lat, before.lon, before.accuracy_m);
    }
    const ratio = (tMs - before.t_ms) / (after.t_ms - before.t_ms);
    return GpsInterpolator.#position(
      before.lat + ratio * (after.lat - before.lat),
      before.lon + ratio * (after.lon - before.lon),
      Math.max(before.accuracy_m, after.accuracy_m),
    );
  }

  static #position(lat: number, lon: number, accuracyM: number): FramePosition {
    return {
      lat: Math.round(lat * DEGREE_STEPS) / DEGREE_STEPS,
      lon: Math.round(lon * DEGREE_STEPS) / DEGREE_STEPS,
      accuracy_m: Math.round(accuracyM * METRE_STEPS) / METRE_STEPS,
    };
  }
}
