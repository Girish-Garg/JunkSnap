import { NotVerifiedError } from "../../domain/letters/errors.js";
import type { LetterSite } from "../../domain/letters/LetterSite.js";

// Decision 20261010-1430: a no-bin letter needs many reporters and a measured absence of bins; other types pass.
export class NoBinEligibility {
  readonly #minReporters: number;
  readonly #radiusM: number;

  constructor(minReporters: number, radiusM: number) {
    this.#minReporters = minReporters;
    this.#radiusM = radiusM;
  }

  check(site: LetterSite): void {
    if (site.reportType !== "no_bin") {
      return;
    }
    const { reporters, noBinWithin3km, nearestBin } = site.evidence;
    const count = reporters ?? 0;
    const nearest = nearestBin === null ? "no known bin nearby" : `nearest known bin ${NoBinEligibility.#km(nearestBin.distance_m)} km`;
    if (count < this.#minReporters) {
      throw new NotVerifiedError(`${count} of ${this.#minReporters} people reported no bin here; ${nearest}. A no-bin letter needs ${this.#minReporters}.`);
    }
    if (noBinWithin3km === null) {
      throw new NotVerifiedError("Bins not mapped here yet, so the missing bin cannot be measured.");
    }
    if (!noBinWithin3km) {
      throw new NotVerifiedError(`A known bin or collection point is within ${NoBinEligibility.#km(this.#radiusM)} km: ${nearest}.`);
    }
  }

  static #km(metres: number): string {
    return (metres / 1000).toFixed(1);
  }
}
