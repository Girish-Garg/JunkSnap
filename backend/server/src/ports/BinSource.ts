import type { KnownBin } from "../domain/bins/KnownBin.js";

export interface BinData {
  readonly bins: readonly KnownBin[];
  // Town slugs (for example jodhpur) whose city file gives at least one known bin.
  readonly mappedTowns: readonly string[];
}

export interface BinSource {
  load(): Promise<BinData>;
}
