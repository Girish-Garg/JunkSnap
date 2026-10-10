import { describe, expect, it } from "vitest";
import { validateLetterDraft, type Site } from "../../src/contracts/index.gen.js";
import { NotVerifiedError } from "../../src/domain/letters/errors.js";
import { LetterSite } from "../../src/domain/letters/LetterSite.js";
import type { LetterRequest } from "../../src/services/letters/LetterService.js";
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

describe("no-bin letters (decision 20261010-1430)", () => {
  it("refuses with how many people reported it and how far the nearest bin is, below 5 reporters", async () => {
    const draft = draftFor(siteWith(noBin, { reporters: 3 }));
    await expect(draft).rejects.toThrow(NotVerifiedError);
    await expect(draft).rejects.toThrow("3 of 5 people reported no bin here; nearest known bin 4.2 km");
  });

  it("refuses when a known bin lies within 3 km or bins are not mapped there", async () => {
    await expect(draftFor(measured(siteWith(noBin, { reporters: 6 }), false, 1200))).rejects.toThrow("within 3.0 km: nearest known bin 1.2 km");
    await expect(draftFor(measured(siteWith(noBin, { reporters: 6 }), null, null))).rejects.toThrow(/bins not mapped here yet/i);
  });

  it("drafts once 5 people reported it and no bin is known within 3 km, saying so in the request", async () => {
    const letter = await draftFor(siteWith(noBin, { reporters: 5 }));
    expect(() => validateLetterDraft(letter)).not.toThrow();
    expect(letter.body).toContain("No waste bin or collection point within 3 km of this site.");
    expect(letter.evidence).toMatchObject({ reporters: 5, no_bin_within_3km: true, nearest_bin: { distance_m: 4210 } });
    const hindi = await draftFor(siteWith(noBin, { reporters: 5 }), "hi");
    expect(hindi.body).toContain("3 किलोमीटर के भीतर कोई कूड़ेदान या कचरा संग्रह केंद्र नहीं है");
  });

  it("uses the configured threshold", () => {
    const site = LetterSite.fromSite(siteWith(noBin, { reporters: 2 }));
    expect(() => new NoBinEligibility(2, 3000).check(site)).not.toThrow();
    expect(() => new NoBinEligibility(3, 3000).check(site)).toThrow("2 of 3 people");
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
