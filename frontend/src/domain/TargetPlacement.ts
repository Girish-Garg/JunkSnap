import { GeoBearing } from './GeoBearing';
import type { LatLon } from './ReportUpload';

/**
 * How far the pin reaches (decision 20261011-0400), from the config's SiteRules: closer than targetHereM, GPS cannot
 * tell the waste from the reporter, so the pin counts as "right here"; targetGroundMaxM from the ground and
 * targetMaxM from a rooftop or upper floor (the api's cap).
 */
export interface TargetReach {
  readonly targetHereM: number;
  readonly targetGroundMaxM: number;
  readonly targetMaxM: number;
}

interface Pin {
  /** Null while the waste is right here. */
  readonly target: LatLon | null;
  readonly high: boolean;
  /** The last move went past the cap and was pulled back to it. */
  readonly capped: boolean;
}

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
  readonly #reach: TargetReach;

  private constructor(reach: TargetReach, origin: LatLon, pin: Pin) {
    this.#reach = reach;
    this.origin = origin;
    this.target = pin.target;
    this.high = pin.high;
    this.capped = pin.capped;
  }

  static here(origin: LatLon, reach: TargetReach): TargetPlacement {
    return new TargetPlacement(reach, { lat: origin.lat, lon: origin.lon }, { target: null, high: false, capped: false });
  }

  get capM(): number {
    return this.high ? this.#reach.targetMaxM : this.#reach.targetGroundMaxM;
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
    if (metres <= this.#reach.targetHereM) return new TargetPlacement(this.#reach, { ...this.origin }, this.#pin(null, false));
    if (metres <= this.capM) return this.#with(this.#pin(TargetPlacement.#round(point), false));
    const capped = GeoBearing.offset(this.origin, GeoBearing.between(this.origin, point), this.capM);
    return this.#with(this.#pin(TargetPlacement.#round(capped), true));
  }

  /** Up high reaches targetMaxM; back on the ground a farther pin is pulled in to targetGroundMaxM. */
  withHighView(high: boolean): TargetPlacement {
    const moved = this.#with({ target: null, high, capped: false });
    return this.target ? moved.moveTo(this.target) : moved;
  }

  reset(): TargetPlacement {
    return this.#with(this.#pin(null, false));
  }

  #pin(target: LatLon | null, capped: boolean): Pin {
    return { target, high: this.high, capped };
  }

  #with(pin: Pin): TargetPlacement {
    return new TargetPlacement(this.#reach, this.origin, pin);
  }

  static #round(point: LatLon): LatLon {
    // Rounding to 0.1 m never lets a capped pin cross the cap by more than the server's 1 m rounding.
    return { lat: Math.round(point.lat * DECIMALS) / DECIMALS, lon: Math.round(point.lon * DECIMALS) / DECIMALS };
  }
}
