import type { Logger } from "pino";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import type { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import { Box } from "../../src/domain/brands/Box.js";
import { BrandAlias } from "../../src/domain/brands/BrandAlias.js";
import { BrandEntry } from "../../src/domain/brands/BrandEntry.js";
import type { ModelSource, TextLine, TextReading } from "../../src/domain/brands/TextReading.js";
import type { BrandJudge, JudgeCase, JudgeVerdict } from "../../src/ports/brands/BrandJudge.js";
import type { BrandMap } from "../../src/ports/brands/BrandMap.js";
import type { TextPresence } from "../../src/ports/brands/TextPresence.js";
import type { TextReader } from "../../src/ports/brands/TextReader.js";
import type { LogSink } from "../LogSink.js";

export const OCR: ModelSource = { provider: "rekognition", model: "DetectText", version: "3.0" };
export const LLM: ModelSource = { provider: "bedrock", model: "sample-judge", version: "1" };

function entry(brand: string, aliases: readonly (readonly [string, boolean])[]): BrandEntry {
  const sourceUrl = `https://example.org/brands/${brand.toLowerCase().replace(/[^a-z]/g, "")}`;
  const parsed = aliases.map(([text, exact]) => new BrandAlias(text, exact));
  return new BrandEntry({ brand, parentCompany: `${brand} Parent`, sourceUrl, aliases: parsed });
}

export const ENTRIES = [
  entry("Pepsi", [["Pepsi", true]]),
  entry("Kurkure", [["Kurkure", false]]),
  entry("Coca-Cola", [["Coca-Cola", false], ["Coca Cola", false]]),
  entry("Lay's", [["Lay's", true], ["Lays", true]]),
  entry("Britannia", [["Britannia", false]]),
  entry("Parle-G", [["Parle-G", false], ["Parle G", false]]),
  entry("Bikaji", [["Bikaji", false], ["बीकाजी", false]]),
];

// Words laid out left to right on one line; confidence is 0 to 1.
export function line(...words: readonly (readonly [string, number])[]): TextLine {
  const parts = words.map(([text, confidence], index) => ({
    text,
    confidence,
    box: new Box({ left: 0.1 + index * 0.2, top: 0.5, width: 0.15, height: 0.05 }),
  }));
  const confidence = Math.min(...parts.map((part) => part.confidence));
  return { text: parts.map((part) => part.text).join(" "), confidence, words: parts };
}

export class FakeTextReader implements TextReader {
  readonly #lines: readonly TextLine[];

  constructor(lines: readonly TextLine[]) {
    this.#lines = lines;
  }

  async read(): Promise<TextReading> {
    return { lines: this.#lines, source: OCR };
  }
}

export class FakeBrandMap implements BrandMap {
  async entries(): Promise<readonly BrandEntry[]> {
    return ENTRIES;
  }
}

export class FakeTextPresence implements TextPresence {
  asked = 0;
  readonly #hasText: boolean;

  constructor(hasText: boolean) {
    this.#hasText = hasText;
  }

  async hasText(): Promise<boolean> {
    this.asked += 1;
    return this.#hasText;
  }
}

export type VerdictRule = (judgeCase: JudgeCase) => Omit<JudgeVerdict, "caseId" | "source"> | undefined;

// Answers each case by a rule, or throws the given error.
export class FakeBrandJudge implements BrandJudge {
  readonly calls: (readonly JudgeCase[])[] = [];
  readonly #rule: VerdictRule | Error;

  constructor(rule: VerdictRule | Error = () => undefined) {
    this.#rule = rule;
  }

  async judge(_image: BlurredImage, cases: readonly JudgeCase[]): Promise<readonly JudgeVerdict[]> {
    this.calls.push(cases);
    const rule = this.#rule;
    if (rule instanceof Error) {
      throw rule;
    }
    return cases.flatMap((judgeCase) => {
      const verdict = rule(judgeCase);
      return verdict === undefined ? [] : [{ ...verdict, caseId: judgeCase.id, source: LLM }];
    });
  }
}

export function brandLogger(sink: LogSink): Logger {
  return new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
}
