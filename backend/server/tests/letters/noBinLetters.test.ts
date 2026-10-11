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

// A zone backed by people who reported it (photo people) and people who voted yes; each counts once.
function zone(reported: number, votedYes: number, verified = reported + votedYes >= 10): Site {
  const backers = { count: reported + votedYes, needed: 10 as const, photo_people: reported, vote_people: votedYes };
  return siteWith(noBin, { reporters: reported, backers, verification: verified ? "verified" : "unverified" });
}

describe("no-bin letters (decision 20261010-1630)", () => {
  it("refuses a zone fewer than 10 people confirmed, counting reports and yes votes together", async () => {
    const draft = draftFor(zone(3, 4));
    await expect(draft).rejects.toThrow(NotVerifiedError);
    await expect(draft).rejects.toThrow("not verified");
    expect(() => new NoBinEligibility(3000).check(LetterSite.fromSite(zone(3, 4)))).toThrow("7 of 10 people have confirmed no dustbin within 1 km");
  });

  it("drafts for a zone 4 people reported and 6 confirmed by vote, showing a mapped bin nearby as evidence", async () => {
    const letter = await draftFor(measured(zone(4, 6), false, 420));
    expect(() => validateLetterDraft(letter)).not.toThrow();
    expect(letter.body).toContain("10 people confirmed there is no dustbin within 1 km of this spot.");
    expect(letter.body).toContain("A mapped bin is 420 m away (OpenStreetMap, ward records); it may be missing or broken.");
    expect(letter.evidence).toMatchObject({ reporters: 4, nearest_bin: { distance_m: 420 } });
  });

  it("says no mapped bin is within the radius when none is, in English and Hindi", async () => {
    const letter = await draftFor(zone(3, 9));
    expect(letter.body).toContain("12 people confirmed there is no dustbin within 1 km of this spot.");
    expect(letter.body).toContain("No mapped bin or collection point within 3 km (OpenStreetMap, ward records).");
    const hindi = await draftFor(zone(3, 9), "hi");
    expect(hindi.body).toContain("12 लोगों ने पुष्टि की है कि इस जगह के 1 किलोमीटर के भीतर कोई कूड़ेदान नहीं है");
  });

  it("gives the model the template's statement: who confirmed it and any mapped bin, as evidence", () => {
    const site = LetterSite.fromSite(measured(zone(5, 5), false, 300));
    expect(new EnglishWording(2500).request(site)).toContain("10 people confirmed there is no dustbin within 1 km of this spot. A mapped bin is 300 m away");
    const brief = { site, addressees: { channel: "local_body", to: { office: "Commissioner", body: "Jodhpur Municipal Corporation" }, cc: [], filingUrl: null }, citations: [], language: "en", binRadiusM: 2000 } as const;
    const prompt = new LetterPrompt(brief).user();
    expect(prompt).toContain("10 people confirmed there is no dustbin within 1 km of this spot. A mapped bin is 300 m away (OpenStreetMap, ward records)");
    expect(prompt).not.toContain("No known waste bin");
    const far = LetterSite.fromSite(zone(5, 5));
    expect(new HindiWording(2500).request(far)).toContain("2.5 किलोमीटर");
  });
});

describe("no-bin letters state the bin distance only as measured", () => {
  const brief = (site: LetterSite) =>
    ({ site, addressees: { channel: "local_body", to: { office: "Commissioner", body: "Jodhpur Municipal Corporation" }, cc: [], filingUrl: null }, citations: [], language: "en", binRadiusM: 3000 }) as const;
  const statement = (site: Site) => {
    const letterSite = LetterSite.fromSite(site);
    const facts = JSON.parse(new LetterPrompt(brief(letterSite)).user()) as { no_bin_statement: string };
    return { english: new EnglishWording(3000).request(letterSite), hindi: new HindiWording(3000).request(letterSite), prompt: facts.no_bin_statement };
  };

  it("gives a bin inside the zone in metres", () => {
    const { english, prompt } = statement(measured(zone(5, 5), false, 500));
    expect(english).toContain("A mapped bin is 500 m away (OpenStreetMap, ward records); it may be missing or broken.");
    expect(prompt).toContain("A mapped bin is 500 m away");
  });

  it("gives the measured distance of a bin past the zone but inside the radius, never none within it", () => {
    const { english, hindi, prompt } = statement(measured(zone(5, 5), false, 1840));
    expect(english).toContain("The nearest mapped bin or collection point is 1.8 km away (OpenStreetMap, ward records).");
    expect(hindi).toContain("1.8 किलोमीटर दूर दर्ज है");
    expect(prompt).toContain("1.8 km away");
    expect([english, hindi, prompt].join(" ")).not.toMatch(/No mapped bin|के भीतर नक्शे पर कोई/);
  });

  it("says none within the radius only when the nearest bin was measured farther than it", () => {
    const { english, prompt } = statement(measured(zone(5, 5), true, 4210));
    expect(english).toContain("No mapped bin or collection point within 3 km (OpenStreetMap, ward records).");
    expect(prompt).toContain("No mapped bin or collection point within 3 km");
  });

  it("says nothing about bins when they were never measured", () => {
    const { english, hindi, prompt } = statement(measured(zone(5, 5), null, null));
    expect(prompt).toBe("10 people confirmed there is no dustbin within 1 km of this spot.");
    expect(english).toBe(`${prompt} We request that waste bins be placed here and that regular collection be arranged.`);
    expect([english, hindi].join(" ")).not.toMatch(/mapped|OpenStreetMap|किलोमीटर दूर|3 किलोमीटर/);
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
