import { describe, expect, it } from "vitest";
import type { CcLine } from "../../src/domain/letters/types.js";
import { WordingCheck } from "../../src/services/letters/WordingCheck.js";
import { DEVICE, USER, FakeWriter, letterService, MODEL, RecordingLogger, wardSite } from "./support.js";

const check = new WordingCheck();
const seat = (office: CcLine["office"]): CcLine => ({ office, seat: { id: `s-${office}`, name: "Jodhpur" }, marking: "for attention" });
const ALL = [seat("councillor"), seat("mla"), seat("mp")];

describe("WordingCheck", () => {
  it("passes neutral prose that copies only offices in the Cc list", () => {
    expect(check.problem("Copies go for attention to the MLA and the MP for Jodhpur.", [seat("mla"), seat("mp")])).toBeNull();
    expect(check.problem("Jodhpur के पार्षद, विधायक और सांसद को सूचनार्थ।", ALL)).toBeNull();
    expect(check.problem("आदरणीय श्रीमान, कृपया स्थान साफ़ कराएँ। Dear Sir or Madam.", ALL)).toBeNull();
  });

  it.each([
    ["illegal", "This illegal dump must go."],
    ["illegally", "Waste is dumped illegally here."],
    ["culprit", "The Culprits must be found."],
    ["अवैध", "यह अवैध कचरा है।"],
    ["गैरकानूनी", "यह गैरकानूनी है।"],
    ["ग़ैर-क़ानूनी (nukta)", "यह ग़ैर-क़ानूनी है।"],
    ["दोषी", "दोषी लोगों पर कार्रवाई हो।"],
    ["अपराधी", "अपराधी पकड़े जाएँ।"],
  ])("refuses the forbidden word %s", (_word, prose) => {
    expect(check.problem(prose, ALL)).toBe("uses a word the shared wording forbids");
  });

  it.each([
    ["Mr", "Please ask Mr Sharma to act."],
    ["Shri", "Copy to Shri. Verma."],
    ["Dr", "Dr. Gupta reported it."],
    ["श्री", "श्री वर्मा को सूचित करें।"],
    ["श्रीमती", "श्रीमती गुप्ता ने बताया।"],
  ])("refuses a person named with %s", (_honorific, prose) => {
    expect(check.problem(prose, ALL)).toBe("names a person");
  });

  it.each<[CcLine["office"], string]>([
    ["mla", "Copies go to the MLA for Jodhpur."],
    ["mla", "प्रतिलिपि विधायक को।"],
    ["mp", "Copies go to the MP and the Member of Parliament."],
    ["mp", "प्रतिलिपि सांसद को।"],
    ["councillor", "The ward councillor is copied."],
    ["councillor", "प्रतिलिपि पार्षद को।"],
  ])("refuses a %s mention when that office is not copied", (office, prose) => {
    const others = ALL.filter((line) => line.office !== office);
    expect(check.problem(prose, others)).toBe(`mentions the ${office} office, which is not copied`);
    expect(check.problem(prose, ALL)).toBeNull();
  });
});

describe("LetterService with the wording check", () => {
  const request = { siteId: "site_jdh_1", channel: "local_body", language: "en", requester: { deviceToken: DEVICE, userId: USER } } as const;

  function writing(extra: string): FakeWriter {
    return new FakeWriter((brief) => {
      const quotes = brief.citations.map((citation) => `"${citation.quote}"`).join("\n");
      return { subject: "Request", body: `${quotes}\n\n${extra}`, provenance: MODEL };
    });
  }

  it.each([
    ["a forbidden word", "This illegal dump must be cleared."],
    ["a named person", "Mr Sharma saw it."],
    ["an office that is not copied", "Copies go to the councillor."],
  ])("falls back to the template when the model writes %s", async (_name, extra) => {
    const logger = new RecordingLogger();
    const site = wardSite({ ward: null, representatives: wardSite().properties.location.representatives.slice(1) });
    const letter = await (await letterService({ sites: [site], writer: writing(extra), logger })).draft(request);
    expect(letter).toMatchObject({ template_fallback: true, provider: "junksnap" });
    expect(letter.body).not.toContain(extra);
  });

  it("ships the same draft when the prose is clean", async () => {
    const letter = await (await letterService({ sites: [wardSite()], writer: writing("Please clear it.") })).draft(request);
    expect(letter.template_fallback).toBe(false);
  });
});
