import { describe, expect, it } from "vitest";
import { validateBrandLabel } from "../../src/contracts/index.gen.js";
import { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import type { TextLine } from "../../src/domain/brands/TextReading.js";
import { BrandJudgeStep } from "../../src/services/brands/BrandJudgeStep.js";
import { BrandLabeller } from "../../src/services/brands/BrandLabeller.js";
import { FakeBrandJudge, FakeBrandMap, FakeTextPresence, FakeTextReader, line, type VerdictRule } from "./fakes.js";

const IMAGE = new BlurredImage("rpt_jdh_1");

interface Run {
  readonly lines: readonly TextLine[];
  readonly rule?: VerdictRule;
  readonly hasText?: boolean;
}

async function labelsFor({ lines, rule, hasText = false }: Run) {
  const judge = new FakeBrandJudge(rule);
  const presence = new FakeTextPresence(hasText);
  const labeller = new BrandLabeller({
    reader: new FakeTextReader(lines),
    map: new FakeBrandMap(),
    judgeStep: new BrandJudgeStep(judge, presence),
  });
  const labels = await labeller.label(IMAGE);
  return { labels, judge, presence };
}

function brandsOf(labels: readonly { brand: string; confidence: number }[]) {
  return labels.map(({ brand, confidence }) => [brand, confidence]);
}

describe("BrandLabeller matching", () => {
  it("labels an exact word with the word's confidence and the row's source", async () => {
    const { labels, judge } = await labelsFor({ lines: [line(["PEPSI", 0.99])] });
    expect(labels).toEqual([
      {
        report_id: "rpt_jdh_1",
        brand: "Pepsi",
        parent_company: "Pepsi Parent",
        confidence: 0.99,
        text_seen: "PEPSI",
        box: { left: 0.1, top: 0.5, width: 0.15, height: 0.05 },
        mapping_source_url: "https://example.org/brands/pepsi",
        provider: "rekognition",
        model: "DetectText",
        version: "3.0",
      },
    ]);
    expect(judge.calls).toEqual([]);
  });

  it("matches aliases across punctuation, case and two-word runs", async () => {
    const lines = [line(["LAY'S", 0.98]), line(["Classic", 0.99], ["Coca", 0.97], ["Cola", 0.96])];
    const { labels } = await labelsFor({ lines });
    expect(brandsOf(labels)).toEqual([["Lay's", 0.98], ["Coca-Cola", 0.96]]);
    expect(labels[1]).toMatchObject({ text_seen: "Coca Cola", box: { left: 0.3, width: 0.35 } });
  });

  it("allows one edit for 5-8 letters and two for 9 or more, but none for require_exact aliases", async () => {
    const lines = [line(["PEPSl", 0.99]), line(["KURKURF", 0.99]), line(["BRITANNLA", 0.99])];
    const { labels } = await labelsFor({ lines });
    expect(brandsOf(labels)).toEqual([["Britannia", 0.88], ["Kurkure", 0.848]]);
  });

  it("never matches inside a longer word or across extra words", async () => {
    const lines = [line(["PEPSICO", 0.99]), line(["KURKURES", 0.99]), line(["Bikajiwala", 0.99]), line(["Coca", 0.99])];
    const { labels, judge } = await labelsFor({ lines });
    expect(labels).toEqual([]);
    expect(judge.calls).toEqual([]);
  });

  it("drops matches below the judge floor without asking the judge", async () => {
    const { labels, judge } = await labelsFor({ lines: [line(["PEPSI", 0.6])] });
    expect(labels).toEqual([]);
    expect(judge.calls).toEqual([]);
  });

  it("keeps one label per brand, the most confident", async () => {
    const lines = [line(["Pepsi", 0.85]), line(["PEPSI", 0.97]), line(["pepsi", 0.9])];
    const { labels } = await labelsFor({ lines });
    expect(brandsOf(labels)).toEqual([["Pepsi", 0.97]]);
  });
});

describe("BrandLabeller judge step", () => {
  const confirm: VerdictRule = (judgeCase) => ({ brand: judgeCase.options[0]?.brand ?? null, confidence: 0.9, textSeen: judgeCase.textSeen });

  it("asks the judge only about near-threshold brands and labels what it confirms", async () => {
    const lines = [line(["PEPSI", 0.7]), line(["KURKURE", 0.95]), line(["Kurkure", 0.7])];
    const { labels, judge } = await labelsFor({ lines, rule: confirm });
    expect(judge.calls).toHaveLength(1);
    expect(judge.calls[0]?.map((judgeCase) => judgeCase.options.map((option) => option.brand))).toEqual([["Pepsi"]]);
    expect(brandsOf(labels)).toEqual([["Kurkure", 0.95], ["Pepsi", 0.9]]);
    expect(labels[1]).toMatchObject({ provider: "bedrock", model: "sample-judge", box: { left: 0.1, top: 0.5 } });
  });

  it("ignores verdicts for brands not offered or text that does not match the alias", async () => {
    const otherBrand: VerdictRule = () => ({ brand: "Kurkure", confidence: 0.95, textSeen: "KURKURE" });
    const misread: VerdictRule = () => ({ brand: "Pepsi", confidence: 0.95, textSeen: "Popsi" });
    for (const rule of [otherBrand, misread]) {
      const { labels } = await labelsFor({ lines: [line(["PEPSI", 0.7])], rule });
      expect(labels).toEqual([]);
    }
  });

  it("drops a near-threshold match when the judge abstains", async () => {
    const { labels, judge } = await labelsFor({ lines: [line(["Kurkure", 0.75])] });
    expect(judge.calls).toHaveLength(1);
    expect(labels).toEqual([]);
  });

  it("sends Devanagari brands to the judge only when text is present and the OCR read nothing", async () => {
    const devanagari: VerdictRule = () => ({ brand: "Bikaji", confidence: 0.92, textSeen: "बीकाजी भुजिया" });
    const unread = await labelsFor({ lines: [line(["~", 0.4])], rule: devanagari, hasText: true });
    expect(unread.judge.calls[0]?.map((judgeCase) => judgeCase.options.map((option) => option.brand))).toEqual([["Bikaji"]]);
    expect(unread.labels).toMatchObject([{ brand: "Bikaji", text_seen: "बीकाजी", confidence: 0.92, box: { left: 0, width: 1 } }]);

    const latin = await labelsFor({ lines: [line(["NET", 0.99], ["WT", 0.99])], rule: devanagari, hasText: true });
    expect([latin.presence.asked, latin.judge.calls.length, latin.labels]).toEqual([0, 0, []]);
    const blank = await labelsFor({ lines: [], rule: devanagari, hasText: false });
    expect([blank.presence.asked, blank.judge.calls.length]).toEqual([1, 0]);
  });
});

describe("BrandLabeller output", () => {
  it("validates against the brand_label contract", async () => {
    const lines = [line(["LAYS", 0.99]), line(["Coca", 0.97], ["Cola", 0.96]), line(["PEPSI", 0.7])];
    const confirm: VerdictRule = () => ({ brand: "Pepsi", confidence: 0.85, textSeen: "Pepsi" });
    const { labels } = await labelsFor({ lines, rule: confirm });
    expect(labels).toHaveLength(3);
    for (const label of labels) {
      expect(validateBrandLabel(label)).toBe(label);
    }
  });
});
