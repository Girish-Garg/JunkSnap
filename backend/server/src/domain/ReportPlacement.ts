import type { ReportUpload } from "../contracts/index.gen.js";
import { GeoPoint } from "./sites/GeoPoint.js";
import { TargetTooFarError } from "./TargetTooFarError.js";

// Decision 20261011-0400-hem-long-range-target: the farthest the waste may be from the reporter's GPS fix.
export const TARGET_MAX_M = 500;

type Placed = Pick<ReportUpload, "gps" | "target">;

// Where the reporter stood (authenticity evidence, never public) and where the waste is (the site's spot).
export class ReportPlacement {
  readonly reporter: GeoPoint;
  readonly spot: GeoPoint;
  readonly longRange: boolean;

  private constructor(reporter: GeoPoint, spot: GeoPoint, longRange: boolean) {
    this.reporter = reporter;
    this.spot = spot;
    this.longRange = longRange;
    Object.freeze(this);
  }

  // Without a target the waste is where the reporter stands.
  static of({ gps, target }: Placed): ReportPlacement {
    const reporter = new GeoPoint(gps.lat, gps.lon);
    return target === undefined
      ? new ReportPlacement(reporter, reporter, false)
      : new ReportPlacement(reporter, new GeoPoint(target.lat, target.lon), true);
  }

  // Metres from the reporter to the spot, rounded to 1 m; 0 without a target.
  distanceM(): number {
    return Math.round(this.reporter.distanceTo(this.spot));
  }

  assertWithinCap(): void {
    const distance = this.distanceM();
    if (distance > TARGET_MAX_M) {
      throw new TargetTooFarError(
        `The marked spot is ${distance} m from you. Mark waste you can see within ${TARGET_MAX_M} m.`,
      );
    }
  }

  // The reports row's evidence: the distance, only for a long-range report.
  evidence(): { readonly target_distance_m?: number } {
    return this.longRange ? { target_distance_m: this.distanceM() } : {};
  }
}
