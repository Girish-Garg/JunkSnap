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
    const nearest = NoBinEligibility.#nearest(noBinWithin3km, nearestBin === null ? null : nearestBin.distance_m);
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

  get radiusM(): number {
    return this.#radiusM;
  }

  static #nearest(within: boolean | null, distance: number | null): string {
    if (within === null) {
      return "bins not mapped here yet";
    }
    return distance === null ? "no known bin nearby" : `nearest known bin ${NoBinEligibility.#km(distance)} km`;
  }

  static #km(metres: number): string {
    return (metres / 1000).toFixed(1);
  }
}
