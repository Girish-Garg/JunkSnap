import type { BrandLabel } from "../../contracts/index.gen.js";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import type { BrandCandidate } from "../../domain/brands/BrandCandidate.js";
import type { BrandMap } from "../../ports/brands/BrandMap.js";
import type { TextReader } from "../../ports/brands/TextReader.js";
import type { BrandJudgeStep } from "./BrandJudgeStep.js";
import { BrandMatcher } from "./BrandMatcher.js";

export interface BrandLabellerParts {
  readonly reader: TextReader;
  readonly map: BrandMap;
  readonly judgeStep: BrandJudgeStep;
}

// Packaging seen on the blurred photo: only readable brands at 0.8 or more, one label per brand.
export class BrandLabeller {
  readonly #reader: TextReader;
  readonly #map: BrandMap;
  readonly #judgeStep: BrandJudgeStep;

  constructor(parts: BrandLabellerParts) {
    this.#reader = parts.reader;
    this.#map = parts.map;
    this.#judgeStep = parts.judgeStep;
  }

  async label(image: BlurredImage): Promise<BrandLabel[]> {
    const [entries, reading] = await Promise.all([this.#map.entries(), this.#reader.read(image)]);
    const found = new BrandMatcher(entries).match(reading.lines, reading.source);
    const judged = await this.#judgeStep.run({ image, reading, found, entries });
    const sure = found.filter((candidate) => candidate.band() === "label");
    return this.#bestPerBrand([...sure, ...judged]).map((candidate) => candidate.toLabel(image.reportId));
  }

  #bestPerBrand(candidates: readonly BrandCandidate[]): BrandCandidate[] {
    const best = new Map<string, BrandCandidate>();
    for (const candidate of candidates) {
      if (candidate.beats(best.get(candidate.brand))) {
        best.set(candidate.brand, candidate);
      }
    }
    return [...best.values()].sort((a, b) => b.confidence - a.confidence);
  }
}
