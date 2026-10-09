import { Box } from "../../domain/brands/Box.js";
import { BrandAlias } from "../../domain/brands/BrandAlias.js";
import { BrandCandidate } from "../../domain/brands/BrandCandidate.js";
import type { BrandEntry } from "../../domain/brands/BrandEntry.js";
import type { ModelSource, TextLine, TextWord } from "../../domain/brands/TextReading.js";

const MAX_RUN_WORDS = 3;

// Matches whole words and 2-3 word runs within one line, never part of a word.
export class BrandMatcher {
  readonly #entries: readonly BrandEntry[];

  constructor(entries: readonly BrandEntry[]) {
    this.#entries = entries;
  }

  match(lines: readonly TextLine[], source: ModelSource): BrandCandidate[] {
    return lines.flatMap((line) => this.#runs(line).flatMap((run) => this.#matchRun(run, source)));
  }

  #runs(line: TextLine): TextWord[][] {
    const words = line.words.filter((word) => BrandAlias.normalise(word.text) !== "");
    const runs: TextWord[][] = [];
    for (let start = 0; start < words.length; start += 1) {
      for (let size = 1; size <= MAX_RUN_WORDS && start + size <= words.length; size += 1) {
        runs.push(words.slice(start, start + size));
      }
    }
    return runs;
  }

  #matchRun(run: readonly TextWord[], source: ModelSource): BrandCandidate[] {
    const textSeen = run.map((word) => word.text).join(" ");
    const normalised = BrandAlias.normalise(textSeen);
    const readable = Math.min(...run.map((word) => word.confidence));
    const box = Box.union(run.map((word) => word.box));
    return this.#entries.flatMap((entry) => {
      const quality = entry.quality(normalised, run.length);
      return quality > 0 ? [new BrandCandidate({ entry, textSeen, box, confidence: readable * quality, source })] : [];
    });
  }
}
