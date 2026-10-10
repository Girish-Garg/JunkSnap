import { BinGrid } from "../domain/bins/BinGrid.js";
import { UNMEASURED, type BinMeasure } from "../domain/bins/KnownBin.js";
import { townSlug } from "../domain/bins/utils.js";
import type { GeoPoint } from "../domain/sites/GeoPoint.js";
import type { BinData } from "../ports/BinSource.js";

// The nearest known bin for a site; a town without crawled bin data is unmeasured, never "no bin".
export class BinLocator {
  readonly #grid: BinGrid;
  readonly #mappedTowns: ReadonlySet<string>;
  readonly #radiusM: number;

  constructor(data: BinData, radiusM: number) {
    this.#grid = new BinGrid(data.bins);
    this.#mappedTowns = new Set(data.mappedTowns);
    this.#radiusM = radiusM;
  }

  measure(point: GeoPoint, town: string | null): BinMeasure {
    if (town === null || !this.#mappedTowns.has(townSlug(town))) {
      return UNMEASURED;
    }
    const found = this.#grid.nearest(point);
    if (found === null) {
      return { nearest_bin: null, no_bin_within_3km: true };
    }
    const { bin, distanceM } = found;
    const nearest_bin = { distance_m: Math.round(distanceM), ref: bin.ref, source: { ...bin.source } };
    return { nearest_bin, no_bin_within_3km: distanceM > this.#radiusM };
  }
}
