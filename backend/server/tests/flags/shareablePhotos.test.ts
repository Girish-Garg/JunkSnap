import { describe, expect, it } from "vitest";
import { LetterPrompt } from "../../src/adapters/letters/LetterPrompt.js";
import type { Site } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { LetterSite } from "../../src/domain/letters/LetterSite.js";
import { ShareUrls } from "../../src/domain/share/ShareUrls.js";
import { SiteCardWriter } from "../../src/domain/share/SiteCardWriter.js";
import { ShareablePhotos } from "../../src/domain/sites/ShareablePhotos.js";
import { areaLetterService, ASSEMBLY, assemblySites, REQUESTER } from "../letters/areaSupport.js";
import { DEVICE, downWriter, letterService, siteFixture, siteWith, USER } from "../letters/support.js";

type Flags = NonNullable<Site["properties"]["photo_flags"]>;

const BASE = "https://d111111abcdef8.cloudfront.net";
const WEB = "https://demo.example.amplifyapp.com";
const FIRST = `${BASE}/media/reports/rpt_jdh_1.jpg`;
const SECOND = `${BASE}/media/reports/rpt_jdh_1a.jpg`;
const WARNED: Flags = [{ photo_id: "rpt_jdh_1", count: 3, warned: true, hidden: false }];
const ALL_FLAGGED: Flags = [...WARNED, { photo_id: "rpt_jdh_1a", count: 8, warned: true, hidden: true }];

// jdh-1 holds FIRST then SECOND; the flags say which of them residents reported.
function flagged(photo_flags: Flags): Site {
  return siteWith(siteFixture("jdh-1"), { photo_flags });
}

describe("ShareablePhotos (contracts v1.15 photo flags)", () => {
  it("leaves out warned and hidden photos and keeps the order of the rest", () => {
    expect(new ShareablePhotos(flagged(WARNED).properties).urls()).toEqual([SECOND]);
    expect(new ShareablePhotos(flagged([{ photo_id: "rpt_jdh_1a", count: 5, warned: false, hidden: true }]).properties).urls()).toEqual([FIRST]);
    expect(new ShareablePhotos(flagged(ALL_FLAGGED).properties).urls()).toEqual([]);
  });

  it("keeps a photo fewer than 3 people reported, and every photo of a site with no flags", () => {
    expect(new ShareablePhotos(flagged([{ photo_id: "rpt_jdh_1", count: 2, warned: false, hidden: false }]).properties).urls()).toEqual([FIRST, SECOND]);
    expect(new ShareablePhotos(siteFixture("jdh-1").properties).urls()).toEqual([FIRST, SECOND]);
  });
});

describe("share cards skip reported photos", () => {
  const writer = new SiteCardWriter(new ShareUrls({ publicBaseUrl: BASE, webUrl: WEB }));

  it("shows the next photo when the first is warned", () => {
    expect(writer.card(flagged(WARNED)).image).toMatchObject({ url: SECOND, large: true });
  });

  it("shows the logo when every photo is warned or hidden", () => {
    expect(writer.card(flagged(ALL_FLAGGED)).image).toMatchObject({ url: `${WEB}/brand/icon-512.png`, large: false });
  });
});

describe("letters skip reported photos", () => {
  const request = { siteId: "site_jdh_1", channel: "local_body", requester: { deviceToken: DEVICE, userId: USER } } as const;

  it.each(["en", "hi"] as const)("leaves a warned photo out of the %s template and its evidence", async (language) => {
    const letter = await (await letterService({ sites: [flagged(WARNED)], writer: downWriter() })).draft({ ...request, language });
    expect(letter.evidence.photo_urls).toEqual([SECOND]);
    expect(letter.body).toContain(SECOND);
    expect(letter.body).not.toContain(FIRST);
  });

  it("gives the model no reported photo", () => {
    const site = LetterSite.fromSite(flagged(ALL_FLAGGED));
    const to = { office: "Commissioner", body: "Jodhpur Municipal Corporation" };
    const brief = { site, addressees: { channel: "local_body", to, cc: [], filingUrl: null }, citations: [], language: "en", binRadiusM: 3000 } as const;
    expect(new LetterPrompt(brief).user()).not.toContain("/media/reports/");
  });

  it("leaves a warned photo out of an area letter's worst sites", async () => {
    const sites = assemblySites().map((stored) => ({ ...stored, site: siteWith(stored.site, { photo_flags: WARNED }) }));
    const service = await areaLetterService({ sites });
    const letter = await service.draft({ area: AreaKey.parse("assembly", ASSEMBLY), issue: "waste_dump", language: "en", requester: REQUESTER });
    expect(letter.evidence.worst_sites.map((site) => site.photo_urls)).toEqual([[SECOND], [SECOND], [SECOND]]);
    expect(letter.body).not.toContain(FIRST);
  });
});
