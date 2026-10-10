import { GeoBearing } from './GeoBearing';
import type { LatLon } from './ReportUpload';

/** Closer than this, GPS cannot tell the waste from the reporter, so the pin counts as "right here". */
export const HERE_RADIUS_M = 10;
/** How far the pin reaches from the ground, and from a rooftop or upper floor (decision 20261011-0400). */
export const GROUND_CAP_M = 300;
export const HIGH_CAP_M = 500;
// Coordinates sent with 6 decimals: about 0.1 m.
const DECIMALS = 1e6;
// Shown distances are rounded to 5 m; GPS is not finer than that.
const SHOWN_STEP_M = 5;

/**
 * Long-range marking: the reporter's fix at the shutter and where the waste is. A drag or a tap past the cap
 * stops the pin at the cap on the same line, and says so. Immutable: every change returns a new placement.
 */
export class TargetPlacement {
  readonly origin: LatLon;
  /** Null while the waste is right here. */
  readonly target: LatLon | null;
  readonly high: boolean;
  /** The last move went past the cap and was pulled back to it. */
  readonly capped: boolean;

  private constructor(origin: LatLon, target: LatLon | null, high: boolean, capped: boolean) {
    this.origin = origin;
    this.target = target;
    this.high = high;
    this.capped = capped;
  }

  static here(origin: LatLon): TargetPlacement {
    return new TargetPlacement({ lat: origin.lat, lon: origin.lon }, null, false, false);
  }

  get capM(): number {
    return this.high ? HIGH_CAP_M : GROUND_CAP_M;
  }

  /** Where the pin stands: the target, else the reporter. */
  get spot(): LatLon {
    return this.target ?? this.origin;
  }

  get distanceM(): number {
    return this.target ? Math.round(GeoBearing.metres(this.origin, this.target)) : 0;
  }

  /** The distance to show, rounded to 5 m but never below 5 m once there is a target. */
  get shownM(): number {
    return this.target ? Math.max(SHOWN_STEP_M, Math.round(this.distanceM / SHOWN_STEP_M) * SHOWN_STEP_M) : 0;
  }

  /** A drag of the pin or a tap on the map at `point`. */
  moveTo(point: LatLon): TargetPlacement {
    const metres = GeoBearing.metres(this.origin, point);
    // A fresh origin object, so the map sees a new spot and puts the dropped pin back on the reporter.
    if (metres <= HERE_RADIUS_M) return new TargetPlacement({ ...this.origin }, null, this.high, false);
    if (metres <= this.capM) return new TargetPlacement(this.origin, TargetPlacement.#round(point), this.high, false);
    const capped = GeoBearing.offset(this.origin, GeoBearing.between(this.origin, point), this.capM);
    return new TargetPlacement(this.origin, TargetPlacement.#round(capped), this.high, true);
  }

  /** Up high reaches 500 m; back on the ground a farther pin is pulled in to 300 m. */
  withHighView(high: boolean): TargetPlacement {
    const moved = new TargetPlacement(this.origin, null, high, false);
    return this.target ? moved.moveTo(this.target) : moved;
  }

  reset(): TargetPlacement {
    return new TargetPlacement(this.origin, null, this.high, false);
  }

  static #round(point: LatLon): LatLon {
    // Rounding to 0.1 m never lets a capped pin cross the cap by more than the server's 1 m rounding.
    return { lat: Math.round(point.lat * DECIMALS) / DECIMALS, lon: Math.round(point.lon * DECIMALS) / DECIMALS };
  }
}
