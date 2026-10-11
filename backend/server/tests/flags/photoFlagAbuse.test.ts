import { describe, expect, it } from "vitest";
import { validateSite } from "../../src/contracts/index.gen.js";
import type { FlagAuthor } from "../../src/domain/flags/PhotoFlag.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { TooFarError } from "../../src/domain/sites/SiteErrors.js";
import { VoteTally, type Vote } from "../../src/domain/sites/VoteTally.js";
import { WarnedPhotoTexts } from "../../src/services/flags/WarnedPhotoTexts.js";
import { BASE_LAT, BASE_LON, DEVICE_B } from "../sites/builders.js";
import { NOW } from "../sites/fakes.js";
import { FIRST_PHOTO, flagBy, flagger, flagRig, MemoryFlags, request, SECOND_PHOTO, seeded, SITE, type FlagRig } from "./flagFakes.js";
import { RULES } from "../defaults.js";

// Yes votes from people 101 onwards back the site without reporting any photo.
async function backedBy(rig: FlagRig, voters: number): Promise<void> {
  const site = await rig.sites.get(SITE);
  const votes: Vote[] = Array.from({ length: voters }, (_unused, i) => ({ siteId: SITE, ...flagger(101 + i), choice: "confirm", votedAt: NOW }));
  site?.recordVotes(VoteTally.of(votes));
  if (site) {
    rig.sites.put(site);
  }
}

function properties(rig: FlagRig) {
  return validateSite(rig.sites.feature(SITE)).properties;
}

describe("reports from far away", () => {
  it("refuses 8 accounts that are not within 1 km of the site with too_far and records nothing", async () => {
    const rig = flagRig();
    seeded(rig);
    const remote = new GeoPoint(BASE_LAT + 0.5, BASE_LON);
    for (let i = 1; i <= 8; i += 1) {
      await expect(rig.service.flag(request(flagger(i), { point: remote }))).rejects.toThrow(TooFarError);
    }
    await expect(rig.service.flag(request(flagger(9), { point: remote }))).rejects.toMatchObject({ status: 403, code: "too_far" });
    expect(rig.flags.rows.size).toBe(0);
    expect(properties(rig)).toMatchObject({ status: "open", photo_urls: [expect.stringContaining(FIRST_PHOTO)] });
    expect(properties(rig).photo_flags).toBeUndefined();
  });
});

describe("removal needs more reporters than backers", () => {
  it("hides the photo of 8 reporters against 9 backers but keeps the site", async () => {
    const rig = flagRig();
    seeded(rig);
    await backedBy(rig, 8);
    expect(properties(rig)).toMatchObject({ verification: "unverified", backers: { count: 9 } });
    await flagBy(rig, 1, 8);
    expect(properties(rig)).toMatchObject({ status: "open", photo_urls: [] });
    expect(properties(rig).photo_flags).toEqual([{ photo_id: FIRST_PHOTO, count: 8, warned: true, hidden: true }]);
  });

  it("removes a site once a withdrawal leaves only hidden photos", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await flagBy(rig, 1, 8);
    expect(properties(rig).status).toBe("open");
    const site = await rig.sites.get(SITE);
    const rows = await rig.rows.forSite(SITE);
    const mine = rows.filter((row) => row.deviceToken === DEVICE_B);
    const result = site?.withdraw({ mine, others: rows.filter((row) => row.deviceToken !== DEVICE_B), at: NOW });
    expect(result).toMatchObject({ site_removed: true, status: "removed" });
    expect(site?.snapshot().feature.properties).toMatchObject({ removed_reason: "photos_reported", removed_at: NOW });
  });

  it("counts only the reporters of hidden photos still on the site, not of one its reporter withdrew", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await backedBy(rig, 6);
    await flagBy(rig, 1, 14);
    const site = await rig.sites.get(SITE);
    const rows = await rig.rows.forSite(SITE);
    site?.withdraw({ mine: rows.filter((row) => row.reportId === FIRST_PHOTO), others: rows.filter((row) => row.reportId !== FIRST_PHOTO), at: NOW });
    if (site) {
      await rig.sites.save(site);
    }
    await flagBy(rig, 21, 28, SECOND_PHOTO);
    expect(properties(rig)).toMatchObject({ status: "open", photo_urls: [], backers: { count: 7 } });
    expect(properties(rig).photo_flags).toContainEqual({ photo_id: SECOND_PHOTO, count: 8, warned: true, hidden: true });
  });
});

// A second writer's report lands, then the first save loses the version race and the retry counts it too.
class RacingFlags extends MemoryFlags {
  raced = false;

  constructor(readonly rig: () => FlagRig) {
    super();
  }

  override async authorsOf(siteId: string, photoId: string): Promise<FlagAuthor[]> {
    if (!this.raced) {
      this.raced = true;
      await this.put({ ...request(flagger(2)), siteId, photoId, textStatus: "none", moderation: null, createdAt: NOW });
      this.rig().sites.failNextSaves(1);
      return [request(flagger(1))];
    }
    return super.authorsOf(siteId, photoId);
  }
}

describe("a lost save race", () => {
  it("re-reads the photo's reports on retry, so a StaleSiteError never writes back an older count", async () => {
    const holder: { rig?: FlagRig } = {};
    const flags = new RacingFlags(() => holder.rig as FlagRig);
    const rig = flagRig(10, flags);
    holder.rig = rig;
    seeded(rig, true);
    const answer = await rig.service.flag(request(flagger(1)));
    expect(answer.photo.count).toBe(2);
    expect(properties(rig).photo_flags).toEqual([{ photo_id: FIRST_PHOTO, count: 2, warned: false, hidden: false }]);
  });
});

describe("descriptions as community signals", () => {
  it("feed the analysis only once the photo is warned, and start a refresh then", async () => {
    const rig = flagRig();
    seeded(rig, true);
    const texts = new WarnedPhotoTexts(rig.flags, RULES.flags);
    await rig.service.flag(request(flagger(1), { text: "Not this plot" }));
    await rig.service.flag(request(flagger(2), { text: "Shows a shop front" }));
    await rig.service.flag(request(flagger(3), { photo: SECOND_PHOTO, text: "Duplicate of the first" }));
    expect(await texts.shownFor(SITE)).toEqual([]);
    expect(rig.community.sites).toEqual([]);
    await rig.service.flag(request(flagger(4)));
    expect(rig.community.sites).toEqual([SITE]);
    const shown = await texts.shownFor(SITE);
    expect(shown.map((note) => note.text).sort()).toEqual(["Not this plot", "Shows a shop front"]);
    expect(shown.every((note) => note.source === "photo_report")).toBe(true);
  });

  it("start a refresh when concurrent reports jump the photo past the warning", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await rig.service.flag(request(flagger(1), { text: "Not this plot" }));
    await rig.service.flag(request(flagger(2), { text: "Shows a shop front" }));
    // A fourth person's report is stored while the third one is being counted.
    await rig.flags.put({ ...request(flagger(4)), siteId: SITE, photoId: FIRST_PHOTO, textStatus: "none", moderation: null, createdAt: NOW });
    const answer = await rig.service.flag(request(flagger(3)));
    expect(answer.photo).toEqual({ count: 4, warned: true, hidden: false });
    expect(rig.community.sites).toEqual([SITE]);
    await rig.service.flag(request(flagger(4)));
    expect(rig.community.sites).toEqual([SITE]);
  });
});
