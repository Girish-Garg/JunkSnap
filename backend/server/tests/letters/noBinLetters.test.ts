import { describe, expect, it } from "vitest";
import { validateLetterDraft, type Site } from "../../src/contracts/index.gen.js";
import { NotVerifiedError } from "../../src/domain/letters/errors.js";
import { LetterSite } from "../../src/domain/letters/LetterSite.js";
import type { LetterRequest } from "../../src/services/letters/LetterService.js";
import { LetterPrompt } from "../../src/adapters/letters/LetterPrompt.js";
import { EnglishWording } from "../../src/services/letters/EnglishWording.js";
import { HindiWording } from "../../src/services/letters/HindiWording.js";
import { NoBinEligibility } from "../../src/services/letters/NoBinEligibility.js";
import { DEVICE, downWriter, letterService, siteFixture, siteWith, USER } from "./support.js";

const noBin = siteFixture("jdh-2");
const request: LetterRequest = {
  siteId: noBin.properties.site_id,
  channel: "local_body",
  language: "en",
  requester: { deviceToken: DEVICE, userId: USER },
};

function measured(site: Site, within: boolean | null, distance: number | null): Site {
  const insights = site.properties.insights;
  if (insights === undefined) {
    throw new Error("fixture site has no insights");
  }
  const nearest_bin = distance === null ? null : { distance_m: distance, ref: "osm:node/7", source: { source_url: "https://overpass-api.de/api/interpreter", fetched_at: "2026-10-10T01:00:00Z", page_sha256: "a".repeat(64) } };
  return siteWith(site, { insights: { ...insights, nearest_bin, no_bin_within_3km: within } });
}

async function draftFor(site: Site, language: "en" | "hi" = "en") {
  return (await letterService({ sites: [site], writer: downWriter() })).draft({ ...request, language });
}

describe("no-bin letters (decision 20261010-1630)", () => {
  it("refuses a zone fewer than 10 people confirmed, saying how many", async () => {
    const draft = draftFor(siteWith(noBin, { verification: "unverified", reporters: 3 }));
    await expect(draft).rejects.toThrow(NotVerifiedError);
    await expect(draft).rejects.toThrow("not verified");
    const zone = LetterSite.fromSite(siteWith(noBin, { verification: "unverified", reporters: 3 }));
    expect(() => new NoBinEligibility(3000).check(zone)).toThrow("3 of 10 people have confirmed no dustbin within 1 km");
  });

  it("drafts for a verified zone even with a mapped bin nearby, which it shows as evidence", async () => {
    const letter = await draftFor(measured(siteWith(noBin, { reporters: 10 }), false, 420));
    expect(() => validateLetterDraft(letter)).not.toThrow();
    expect(letter.body).toContain("10 people confirmed there is no dustbin within 1 km of this spot.");
    expect(letter.body).toContain("A mapped bin is 420 m away (OpenStreetMap, ward records); it may be missing or broken.");
    expect(letter.evidence).toMatchObject({ reporters: 10, nearest_bin: { distance_m: 420 } });
  });

  it("says no mapped bin is within the radius when none is, in English and Hindi", async () => {
    const letter = await draftFor(siteWith(noBin, { reporters: 10 }));
    expect(letter.body).toContain("No mapped bin or collection point within 3 km (OpenStreetMap, ward records).");
    const hindi = await draftFor(siteWith(noBin, { reporters: 10 }), "hi");
    expect(hindi.body).toContain("10 लोगों ने पुष्टि की है कि इस जगह के 1 किलोमीटर के भीतर कोई कूड़ेदान नहीं है");
  });

  it("states the configured radius in the template and the model prompt", () => {
    const site = LetterSite.fromSite(siteWith(noBin, { reporters: 10 }));
    expect(new EnglishWording(2500).request(site)).toContain("within 2.5 km (OpenStreetMap, ward records)");
    expect(new HindiWording(2500).request(site)).toContain("2.5 किलोमीटर");
    const brief = { site, addressees: { channel: "local_body", to: { office: "Commissioner", body: "Jodhpur Municipal Corporation" }, cc: [], filingUrl: null }, citations: [], language: "en", binRadiusM: 2000 } as const;
    expect(new LetterPrompt(brief).user()).toContain("within 2 km of this site.");
  });
});

describe("letter evidence", () => {
  it("carries counts, dates, blurred photos, measured insights and the nearest bin for a waste dump", async () => {
    const dump = siteFixture("jdh-1");
    const letter = await (await letterService({ sites: [dump], writer: downWriter() })).draft({ ...request, siteId: dump.properties.site_id });
    const facts = dump.properties;
    expect(letter.evidence).toMatchObject({
      report_count: facts.report_count,
      reporters: facts.reporters,
      verified_count: facts.verified_count,
      first_reported_at: facts.first_reported_at,
      last_reported_at: facts.last_reported_at,
      photo_urls: facts.photo_urls,
      nearest_bin: { distance_m: facts.insights?.nearest_bin?.distance_m },
      no_bin_within_3km: facts.insights?.no_bin_within_3km,
    });
    expect(letter.evidence.insights?.composition[0]).toEqual({ material: "plastic", share_pct: 52.5, reports: 6 });
    expect(letter.evidence.insights?.near).toEqual([{ kind: "school", distance_m: 83 }]);
  });

  it("leaves the nearest bin out for other report types", async () => {
    const water = siteFixture("jdh-3");
    const letter = await (await letterService({ sites: [water], writer: downWriter() })).draft({ ...request, siteId: water.properties.site_id });
    expect(letter.evidence).toMatchObject({ nearest_bin: null, no_bin_within_3km: null });
  });
});
