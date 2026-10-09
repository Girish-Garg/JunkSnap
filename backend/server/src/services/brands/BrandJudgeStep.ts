import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import { Box } from "../../domain/brands/Box.js";
import { BrandAlias } from "../../domain/brands/BrandAlias.js";
import { LABEL_THRESHOLD, type BrandCandidate } from "../../domain/brands/BrandCandidate.js";
import type { BrandEntry } from "../../domain/brands/BrandEntry.js";
import type { TextLine, TextReading } from "../../domain/brands/TextReading.js";
import type { BrandJudge, JudgeCase, JudgeVerdict } from "../../ports/brands/BrandJudge.js";
import type { TextPresence } from "../../ports/brands/TextPresence.js";
import { BrandMatcher } from "./BrandMatcher.js";

export interface JudgeStepInput {
  readonly image: BlurredImage;
  readonly reading: TextReading;
  readonly found: readonly BrandCandidate[];
  readonly entries: readonly BrandEntry[];
}

// Decision 0137, LLMs last: the judge sees near-threshold matches, and Devanagari only when the OCR read nothing.
export class BrandJudgeStep {
  readonly #judge: BrandJudge;
  readonly #presence: TextPresence;

  constructor(judge: BrandJudge, presence: TextPresence) {
    this.#judge = judge;
    this.#presence = presence;
  }

  async run(input: JudgeStepInput): Promise<BrandCandidate[]> {
    const cases = [...this.#nearCases(input.found), ...(await this.#unreadCases(input))];
    if (cases.length === 0) {
      return [];
    }
    const verdicts = await this.#judge.judge(input.image, cases);
    return verdicts.flatMap((verdict) => this.#accept(cases, verdict));
  }

  #nearCases(found: readonly BrandCandidate[]): JudgeCase[] {
    const sure = new Set(found.filter((candidate) => candidate.band() === "label").map((candidate) => candidate.brand));
    const best = new Map<string, BrandCandidate>();
    for (const candidate of found) {
      if (candidate.band() === "judge" && !sure.has(candidate.brand) && candidate.beats(best.get(candidate.brand))) {
        best.set(candidate.brand, candidate);
      }
    }
    return [...best.values()].map(({ textSeen, box, entry }, index) => ({ id: `near-${index}`, textSeen, box, options: [entry] }));
  }

  async #unreadCases({ image, reading, entries }: JudgeStepInput): Promise<JudgeCase[]> {
    const options = entries.filter((entry) => entry.hasDevanagari());
    const readSomething = reading.lines.some((line) => line.confidence >= LABEL_THRESHOLD);
    if (options.length === 0 || readSomething || !(await this.#presence.hasText(image))) {
      return [];
    }
    return [{ id: "unread-text", textSeen: "", box: Box.WHOLE_IMAGE, options }];
  }

  // The judge's own reading must still match an alias of a brand it was offered.
  #accept(cases: readonly JudgeCase[], verdict: JudgeVerdict): BrandCandidate[] {
    const judged = cases.find((judgeCase) => judgeCase.id === verdict.caseId);
    const entry = judged?.options.find((option) => option.brand === verdict.brand);
    if (judged === undefined || entry === undefined) {
      return [];
    }
    const { confidence, textSeen, source } = verdict;
    const words = BrandAlias.wordsOf(textSeen).map((text) => ({ text, confidence, box: judged.box }));
    const line: TextLine = { text: textSeen, confidence, words };
    return new BrandMatcher([entry]).match([line], source).filter((candidate) => candidate.band() === "label");
  }
}
