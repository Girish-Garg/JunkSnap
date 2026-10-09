import type { BrandEntry } from "../../domain/brands/BrandEntry.js";

export interface BrandMap {
  entries(): Promise<readonly BrandEntry[]>;
}
