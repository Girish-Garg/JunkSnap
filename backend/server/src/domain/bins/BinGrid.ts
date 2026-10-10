import type { GeoPoint } from "../sites/GeoPoint.js";
import type { KnownBin } from "./KnownBin.js";

// About 5.5 km north-south; rings stop after 10 cells, about 50 km.
const CELL_DEGREES = 0.05;
const MAX_RINGS = 10;
const METRES_PER_DEGREE = 111_320;

export interface FoundBin {
  readonly bin: KnownBin;
  readonly distanceM: number;
}

// A fixed lat/lon grid; nearest() walks rings of cells outward until no closer bin can exist.
export class BinGrid {
  readonly #cells = new Map<string, KnownBin[]>();

  constructor(bins: readonly KnownBin[]) {
    for (const bin of bins) {
      const key = BinGrid.#key(...BinGrid.#cell(bin.point));
      this.#cells.set(key, [...(this.#cells.get(key) ?? []), bin]);
    }
  }

  nearest(point: GeoPoint): FoundBin | null {
    const [row, col] = BinGrid.#cell(point);
    const cellM = CELL_DEGREES * METRES_PER_DEGREE * Math.cos((point.lat * Math.PI) / 180);
    let best: FoundBin | null = null;
    for (let ring = 0; ring <= MAX_RINGS; ring += 1) {
      if (best !== null && (ring - 1) * cellM > best.distanceM) {
        break;
      }
      const found = this.#ring(row, col, ring).map((bin) => ({ bin, distanceM: point.distanceTo(bin.point) }));
      best = [...found, ...(best === null ? [] : [best])].sort((a, b) => a.distanceM - b.distanceM)[0] ?? null;
    }
    return best;
  }

  #ring(row: number, col: number, ring: number): KnownBin[] {
    const offsets = Array.from({ length: 2 * ring + 1 }, (_unused, index) => index - ring);
    const onRing = (dRow: number, dCol: number) => Math.max(Math.abs(dRow), Math.abs(dCol)) === ring;
    const cells = offsets.flatMap((dRow) => offsets.filter((dCol) => onRing(dRow, dCol)).map((dCol) => [row + dRow, col + dCol] as const));
    return cells.flatMap(([cellRow, cellCol]) => this.#cells.get(BinGrid.#key(cellRow, cellCol)) ?? []);
  }

  static #cell(point: GeoPoint): [number, number] {
    return [Math.floor(point.lat / CELL_DEGREES), Math.floor(point.lon / CELL_DEGREES)];
  }

  static #key(row: number, col: number): string {
    return `${row}:${col}`;
  }
}
