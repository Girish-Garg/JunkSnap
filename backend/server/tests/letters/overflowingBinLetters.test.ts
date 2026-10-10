import { describe, expect, it } from "vitest";
import { validateAreaLetterDraft, validateLetterDraft, type Site } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { ChannelNotApplicableError } from "../../src/domain/letters/errors.js";
import type { LetterRequest } from "../../src/services/letters/LetterService.js";
import { areaLetterService, areaSite, ASSEMBLY, assemblySites, REQUESTER } from "./areaSupport.js";
import { DEVICE, downWriter, letterService, REAL_RULES_DIR, siteFixture, siteWith, USER, wardSite } from "./support.js";

// The jdh-4 overflowing bin, placed in a ward with all three seats represented.
const bin = siteWith(siteFixture("jdh-4"), {}, wardSite().properties.location);
const request: LetterRequest = {
  siteId: bin.properties.site_id,
  channel: "local_body",
  language: "en",
  requester: { deviceToken: DEVICE, userId: USER },
};

async function draftFor(site: Site, patch: Partial<LetterRequest> = {}) {
  const service = await letterService({ sites: [site], writer: downWriter(), rulesDir: REAL_RULES_DIR });
  return service.draft({ ...request, ...patch });
}

const overflowing = (id: string, verified: number, context: "overflowing" | "damaged" = "overflowing") =>
  areaSite(id, { report_type: "overflowing_bin", context, verified_count: verified, report_count: verified } as const);

describe("overflowing or broken bin area letters", () => {
  const area = AreaKey.parse("assembly", ASSEMBLY);
  const areaRequest = { area, issue: "overflowing_bin", language: "en", requester: REQUESTER } as const;

  it("drafts one letter about the area's bad-state bins once they hold 10 verified reports", async () => {
    const sites = [overflowing("o1", 6), overflowing("o2", 4, "damaged"), ...assemblySites()];
    const service = await areaLetterService({ sites, rulesDir: REAL_RULES_DIR });
    const letter = await service.draft(areaRequest);
    expect(() => validateAreaLetterDraft(letter)).not.toThrow();
    expect(letter.issue).toBe("overflowing_bin");
    expect(letter.subject).toContain("overflowing or broken waste bins");
    expect(letter.body).toContain("Please empty the bins regularly and repair or replace them.");
    expect(letter.evidence.worst_sites.map((site) => site.site_id)).toEqual(["site_o1", "site_o2"]);
    expect(letter.citations.map((citation) => citation.rule_id)).toContain("swm-2026-39-2-x");
    const hindi = await service.draft({ ...areaRequest, language: "hi" });
    expect(hindi.body).toContain("कृपया इन कूड़ेदानों को नियमित रूप से खाली कराएँ");
  });

  it("refuses with the count below 10 verified reports", async () => {
    const service = await areaLetterService({ sites: [overflowing("o1", 3), ...assemblySites()] });
    await expect(service.draft(areaRequest)).rejects.toThrow("Not enough verified reports yet (3 of 10)");
  });
});

describe("overflowing or broken bin letters (decision 20261010-1645)", () => {
  it("asks the local body to empty the bin and repair or replace it, citing verified SWM clauses only", async () => {
    const letter = await draftFor(bin);
    expect(() => validateLetterDraft(letter)).not.toThrow();
    expect(letter.to).toEqual({ office: "Commissioner", body: "Jodhpur Municipal Corporation" });
    expect(letter.body).toContain("Please empty the bin regularly and repair or replace it.");
    expect(letter.body).toContain("an overflowing waste bin with waste spilling around it");
    expect(letter.citations.map((citation) => citation.rule_id)).toEqual(["swm-2026-39-2-x", "swm-2026-39-2-vii"]);
    expect(letter.citations.every((citation) => citation.verified)).toBe(true);
    expect(letter.verifier).toMatchObject({ verified: 2, total: 2 });
  });

  it("names a damaged bin and still cites the bin placement clause first", async () => {
    const letter = await draftFor(siteWith(bin, { context: "damaged" }));
    expect(letter.body).toContain("a broken, burnt or uncovered waste bin");
    expect(letter.citations[0]?.rule_id).toBe("swm-2026-39-2-x");
  });

  it("writes the request in Hindi and keeps the quotes in English", async () => {
    const letter = await draftFor(bin, { language: "hi" });
    expect(letter.body).toContain("कृपया कूड़ेदान को नियमित रूप से खाली कराएँ और उसकी मरम्मत कराएँ या उसे बदलवाएँ।");
    expect(letter.body).toContain("schedule for street sweeping and placement of waste bins as per prescribed norms");
  });

  it("goes to the District Collector under the quarterly review clause", async () => {
    const letter = await draftFor(bin, { channel: "district_collector" });
    expect(letter.citations.map((citation) => citation.rule_id)).toEqual(["swm-2026-37-ii"]);
  });

  it("goes to the pollution board only when burning was seen", async () => {
    await expect(draftFor(bin, { channel: "pollution_board" })).rejects.toThrow(ChannelNotApplicableError);
    const burnt = siteWith(bin, { burning: true, context: "damaged" });
    const letter = await draftFor(burnt, { channel: "pollution_board" });
    expect(letter.citations.length).toBeGreaterThan(0);
  });
});
