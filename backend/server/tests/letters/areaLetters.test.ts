import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateAreaLetterDraft, validateWardScores, type AreaLetterDraft, type WardScores } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { AreaNotFoundError } from "../../src/domain/AreaNotFoundError.js";
import { NoLocalBodyError, NotVerifiedError, RateLimitedError } from "../../src/domain/letters/errors.js";
import type { AreaLetterRequest } from "../../src/services/letters/AreaLetterService.js";
import {
  ASSEMBLY,
  areaLetterService,
  assemblySites,
  noBinSite,
  FakeScores,
  quotingAreaWriter,
  REQUESTER,
} from "./areaSupport.js";
import { memoryCounters, RecordingLogger, REAL_RULES_DIR, wardSite } from "./support.js";

const assembly = AreaKey.parse("assembly", ASSEMBLY);
const request: AreaLetterRequest = { area: assembly, issue: "waste_dump", language: "en", requester: REQUESTER };

function scoresRow(): WardScores {
  const url = new URL("../../../../contracts/fixtures/ward_scores.jdh-1.json", import.meta.url);
  const row = validateWardScores(JSON.parse(readFileSync(url, "utf8")));
  const citizen = { value: null, reason: "too_few_reports" as const };
  return { ...row, area: { kind: "assembly", id: ASSEMBLY, name: "Sardarpura" }, scores: { ...row.scores, citizen } };
}

function expectValid(letter: AreaLetterDraft): void {
  expect(() => validateAreaLetterDraft(letter)).not.toThrow();
  expect(letter.verifier).toEqual({ verified: letter.citations.length, total: letter.citations.length });
  expect(letter.citations.every((citation) => letter.body.includes(`"${citation.quote}"`))).toBe(true);
}

describe("AreaLetterService: an assembly seat", () => {
  it("drafts a template letter to the local body head, Cc the MLA, with the area's evidence", async () => {
    const scores = new FakeScores({ [assembly.toString()]: scoresRow() });
    const letter = await (await areaLetterService({ scores })).draft(request);
    expectValid(letter);
    expect(letter).toMatchObject({ area: { kind: "assembly", id: ASSEMBLY, name: "Sardarpura" }, issue: "waste_dump" });
    expect(letter.to).toEqual([{ office: "Commissioner", body: "Jodhpur Municipal Corporation" }]);
    expect(letter.cc).toEqual([{ office: "mla", seat: { id: ASSEMBLY, name: "Sardarpura" }, marking: "for attention" }]);
    expect(letter).toMatchObject({ template_fallback: true, provider: "junksnap", model: "area-letter-template" });
    const { evidence } = letter;
    expect(evidence).toMatchObject({ reports: 14, reporters: 4, verified_reports: 12, sites: 3 });
    expect(evidence.first_reported_at).toBe("2026-10-08T05:10:00Z");
    expect(evidence.last_reported_at).toBe("2026-10-10T06:00:00Z");
    expect(evidence.worst_sites.map((site) => site.site_id)).toEqual(["site_a1", "site_a3", "site_a2"]);
    expect(evidence.worst_sites[0]?.photo_urls.length).toBeGreaterThan(0);
    expect(evidence.scores).toEqual([
      { name: "city", value: 41, verified_reports: 14 },
      { name: "bin_access", value: 32, verified_reports: 14 },
    ]);
    expect(evidence.bin_access).toEqual({ sites_measured: 3, sites_without_bin_within_3km: 0 });
  });

  it("writes the counts, worst sites, measured scores and request into the template", async () => {
    const scores = new FakeScores({ [assembly.toString()]: scoresRow() });
    const letter = await (await areaLetterService({ scores })).draft(request);
    expect(letter.subject).toBe("Request for action on waste dumps in Sardarpura assembly constituency (JunkSnap area report)");
    expect(letter.body).toMatch(/^To the Commissioner, Jodhpur Municipal Corporation\./);
    expect(letter.body).toContain("14 reports from 4 people at 3 sites since 8 October 2026, 12 of them verified.");
    expect(letter.body).toContain("- site_a1: waste dump (vacant plot), 6 verified of 7 reports, open since 8 October 2026.");
    expect(letter.body).toContain("from 14 verified reports: city 41 and bin access 32.");
    expect(letter.body).not.toContain("citizen");
    expect(letter.body).toContain("A copy goes for attention to the MLA for Sardarpura.");
  });

  it("writes Hindi prose around the official English quotes", async () => {
    const letter = await (await areaLetterService()).draft({ ...request, language: "hi" });
    expectValid(letter);
    expect(letter.subject).toBe("अनुरोध: Sardarpura विधानसभा क्षेत्र में कचरे के ढेर (JunkSnap क्षेत्र रिपोर्ट)");
    expect(letter.body).toContain("प्रतिलिपि सूचनार्थ: Sardarpura के विधायक।");
  });

  it("ships a model draft that quotes every rule word for word", async () => {
    const writer = quotingAreaWriter("Please clear these sites.");
    const letter = await (await areaLetterService({ writer })).draft(request);
    expect(letter).toMatchObject({ template_fallback: false, provider: "bedrock" });
    expect(writer.briefs[0]?.evidence.verified_reports).toBe(12);
  });

  it.each([
    ["a misquote", (quote: string) => quote.replace("garbage", "rubbish"), ""],
    ["an office not copied", (quote: string) => quote, "Copies go to the ward councillor."],
  ])("falls back to the template on %s", async (_name, change, extra) => {
    const writer = quotingAreaWriter(extra);
    const misquoting = { write: async (brief: Parameters<typeof writer.write>[0]) => {
      const written = await writer.write(brief);
      return { ...written, body: change(written.body) };
    } };
    const letter = await (await areaLetterService({ writer: misquoting })).draft(request);
    expect(letter.template_fallback).toBe(true);
  });

  it("covers every issue with all, citing rules for each type", async () => {
    const letter = await (await areaLetterService()).draft({ ...request, issue: "all" });
    expect(letter.evidence).toMatchObject({ verified_reports: 15, sites: 4 });
    expect(letter.citations.map((citation) => citation.rule_id)).toContain("fx-bins");
    expect(letter.evidence.bin_access).not.toBeNull();
  });

  it("cites decision 12's SWM clauses for a dump letter with the real rules", async () => {
    const letter = await (await areaLetterService({ rulesDir: REAL_RULES_DIR })).draft(request);
    expect(letter.citations.map((citation) => citation.clause).sort()).toEqual(["15(1)", "39(2)(vii)", "39(2)(xi)", "5(1)(f)"]);
  });
});

describe("AreaLetterService: who it goes to by area kind", () => {
  it("sends a ward letter to the local body head, Cc the ward councillor", async () => {
    const letter = await (await areaLetterService()).draft({ ...request, area: AreaKey.parse("ward", "jodhpur-mc-w37") });
    expect(letter.to).toEqual([{ office: "Commissioner", body: "Jodhpur Municipal Corporation" }]);
    expect(letter.cc.map((line) => line.office)).toEqual(["councillor"]);
  });

  it("sends a Lok Sabha letter to the District Collector and the local body head, Cc the MP", async () => {
    const letter = await (await areaLetterService()).draft({ ...request, area: AreaKey.parse("loksabha", "s20-pc-16") });
    expect(letter.to).toEqual([
      { office: "District Collector", body: "Jodhpur district, Rajasthan" },
      { office: "Commissioner", body: "Jodhpur Municipal Corporation" },
    ]);
    expect(letter.cc.map((line) => line.office)).toEqual(["mp"]);
    expect(letter.body).toMatch(/^To:\n- the District Collector, Jodhpur district, Rajasthan\n- the Commissioner/);
  });

  it("never copies the MP of an outdated Lok Sabha seat", async () => {
    const seat = { id: "s20-pc-16", name: "Jodhpur", status: "outdated" as const };
    const sites = assemblySites().map((stored) => ({ ...stored, site: { ...stored.site, properties: { ...stored.site.properties, location: { ...stored.site.properties.location, loksabha_seat: seat } } } }));
    const letter = await (await areaLetterService({ sites })).draft({ ...request, area: AreaKey.parse("loksabha", "s20-pc-16") });
    expect(letter.cc).toEqual([]);
  });

  it("sends a district letter to the Collector and the local body heads, with no Cc", async () => {
    const letter = await (await areaLetterService()).draft({ ...request, area: AreaKey.parse("district", "rajasthan-jodhpur") });
    expect(letter.to.map((recipient) => recipient.office)).toEqual(["District Collector", "Commissioner"]);
    expect(letter.cc).toEqual([]);
  });

  it("returns no_local_body for a ward or assembly letter with no local body to address", async () => {
    const sites = assemblySites().map((stored) => ({ ...stored, site: wardSite({ local_body: null }) }));
    const service = await areaLetterService({ sites: sites.map((stored, index) => ({ ...stored, site: { ...stored.site, properties: { ...stored.site.properties, site_id: `site_n${index}`, verified_count: 5 } } })) });
    await expect(service.draft(request)).rejects.toThrow(NoLocalBodyError);
  });
});

describe("AreaLetterService: when no letter can be drafted", () => {
  it("returns area_not_found for an area with no reported sites", async () => {
    const service = await areaLetterService();
    await expect(service.draft({ ...request, area: AreaKey.parse("assembly", "s20-ac-1") })).rejects.toThrow(AreaNotFoundError);
  });

  it("returns not_verified with the count when the issue has fewer than 10 verified reports", async () => {
    const service = await areaLetterService();
    await expect(service.draft({ ...request, issue: "no_bin" })).rejects.toThrow(NotVerifiedError);
    await expect(service.draft({ ...request, issue: "no_bin" })).rejects.toThrow("Not enough verified reports yet (3 of 10)");
    await expect(service.draft({ ...request, issue: "open_construction" })).rejects.toThrow("(0 of 10)");
  });

  it("counts only no-bin sites with 5 reporters and no bin measured within 3 km, and says why", async () => {
    const sites = [noBinSite("n1", 6, 6, true), noBinSite("n2", 5, 3, true), noBinSite("n3", 5, 7, false)];
    const service = await areaLetterService({ sites });
    await expect(service.draft({ ...request, issue: "no_bin" })).rejects.toThrow(
      "Not enough verified reports yet (6 of 10) for this issue in this area. No-bin sites left out: fewer than 5 people reported no bin (1 site); a known bin or collection point is within 3 km (1 site).",
    );
  });

  it("blocks a no-bin letter where bins are not mapped, however many reports there are", async () => {
    const sites = [noBinSite("m1", 8, 9, null), noBinSite("m2", 7, 6, null)];
    const service = await areaLetterService({ sites });
    await expect(service.draft({ ...request, issue: "no_bin" })).rejects.toThrow(NotVerifiedError);
    await expect(service.draft({ ...request, issue: "no_bin" })).rejects.toThrow("Bins not mapped here yet (2 sites)");
  });

  it("drafts a no-bin letter once enough eligible sites hold 10 verified reports", async () => {
    const sites = [noBinSite("e1", 6, 6, true), noBinSite("e2", 5, 5, true), noBinSite("e3", 9, 2, null)];
    const letter = await (await areaLetterService({ sites })).draft({ ...request, issue: "no_bin" });
    expect(letter.evidence).toMatchObject({ verified_reports: 11, sites: 2, bin_access: { sites_measured: 2, sites_without_bin_within_3km: 2 } });
  });

  it("leaves ineligible no-bin sites out of an all letter", async () => {
    const sites = [...assemblySites(), noBinSite("u9", 9, 1, null)];
    const letter = await (await areaLetterService({ sites })).draft({ ...request, issue: "all" });
    expect(letter.evidence.worst_sites.map((site) => site.site_id)).not.toContain("site_u9");
    expect(letter.evidence.verified_reports).toBe(15);
  });

  it("refuses an over-limit requester before reading any site", async () => {
    const counters = memoryCounters();
    const service = await areaLetterService({ counters });
    for (let letter = 0; letter < 5; letter += 1) {
      await service.draft(request);
    }
    const reads = { count: 0 };
    const counting = await areaLetterService({ counters, sites: [], onRead: () => (reads.count += 1) });
    await expect(counting.draft(request)).rejects.toThrow(RateLimitedError);
    expect(reads.count).toBe(0);
  });

  it("counts area letters in the same 5 an hour", async () => {
    const service = await areaLetterService();
    for (let letter = 0; letter < 5; letter += 1) {
      await service.draft(request);
    }
    await expect(service.draft(request)).rejects.toThrow(RateLimitedError);
  });

  it("logs sites skipped for breaking the site contract and still drafts", async () => {
    const logger = new RecordingLogger();
    await (await areaLetterService({ logger, unreadable: 2 })).draft(request);
    expect(logger.warnings).toContain("skipped sites that break the site contract");
  });
});
