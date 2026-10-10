import { describe, expect, it } from "vitest";
import { validateAreaLetterDraft, validateLetterDraft } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { areaLetterService, ASSEMBLY, REQUESTER } from "./areaSupport.js";
import { DEVICE, downWriter, letterService, quotingWriter, siteWith, USER, wardSite } from "./support.js";

const request = { siteId: "site_jdh_1", channel: "local_body", language: "en", requester: { deviceToken: DEVICE, userId: USER } } as const;

describe("Residents report in site letters", () => {
  it("adds the site's community signals to the evidence and a counted, paraphrased line to the template", async () => {
    const letter = await (await letterService({ sites: [wardSite()], writer: downWriter() })).draft(request);
    expect(() => validateLetterDraft(letter)).not.toThrow();
    expect(letter.evidence.residents).toEqual({
      people: 4,
      signals: { duration_days: 90, recurring: true, burning: true, smell: true, blocked_drain: false, animals: false, near_school: true, near_hospital: false, access_issue: false },
    });
    expect(letter.body).toContain(
      "Residents report (4 people): it has been here about 3 months; it comes back after clearing; it is burnt, with smoke; there is a bad smell; a school is nearby.",
    );
    expect(letter.body).not.toContain("Residents say the dump");
  });

  it("writes the line in Hindi too", async () => {
    const letter = await (await letterService({ sites: [wardSite()], writer: downWriter() })).draft({ ...request, language: "hi" });
    expect(letter.body).toContain("निवासियों की सूचना (4 लोग): यह लगभग 3 महीने से है;");
  });

  it("has no residents line for a site without notes", async () => {
    const quiet = siteWith(wardSite(), { community: null });
    const letter = await (await letterService({ sites: [quiet], writer: downWriter() })).draft(request);
    expect(letter.evidence.residents).toBeNull();
    expect(letter.body).not.toContain("Residents report");
  });

  it("still applies the wording check to a model draft that retells residents' words", async () => {
    const writer = quotingWriter((quote) => quote, "Request");
    const blaming = { write: async (brief: Parameters<typeof writer.write>[0]) => {
      const written = await writer.write(brief);
      return { ...written, body: `${written.body}\n\nResidents say the culprit burns it.` };
    } };
    const letter = await (await letterService({ sites: [wardSite()], writer: blaming })).draft(request);
    expect(letter.template_fallback).toBe(true);
    expect(letter.body).not.toContain("culprit");
  });
});

describe("Residents report in area letters", () => {
  it("counts sites with notes, people and each signal by site", async () => {
    const letter = await (await areaLetterService()).draft({ area: AreaKey.parse("assembly", ASSEMBLY), issue: "waste_dump", language: "en", requester: REQUESTER });
    expect(() => validateAreaLetterDraft(letter)).not.toThrow();
    expect(letter.evidence.residents).toEqual({
      sites: 3,
      people: 12,
      mentions: [
        { signal: "recurring", sites: 3 },
        { signal: "burning", sites: 3 },
        { signal: "smell", sites: 3 },
        { signal: "near_school", sites: 3 },
      ],
    });
    expect(letter.body).toContain("Residents report at 3 of these sites (12 people): returns after clearing at 3 sites; burning or smoke at 3 sites;");
  });
});
