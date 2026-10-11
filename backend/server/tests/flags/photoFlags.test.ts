import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { validatePhotoFlag, validateSite } from "../../src/contracts/index.gen.js";
import { NotFoundError } from "../../src/domain/errors.js";
import { OwnPhotoError } from "../../src/domain/flags/PhotoFlag.js";
import { PhotoFlagPolicy } from "../../src/domain/flags/PhotoFlagPolicy.js";
import { RateLimitedError } from "../../src/domain/letters/errors.js";
import { VoteTally, type Vote } from "../../src/domain/sites/VoteTally.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { BASE_URL, DEVICE_A, DEVICE_B, userOf } from "../sites/builders.js";
import { FixedClock, NOW } from "../sites/fakes.js";
import { FIRST_PHOTO, flagBy, flagger, flagRig, REMOVED, request, SECOND_PHOTO, seeded, SITE, type FlagRig } from "./flagFakes.js";
import { RULES } from "../defaults.js";

const FIRST_URL = `${BASE_URL}/media/reports/${FIRST_PHOTO}.jpg`;
const SECOND_URL = `${BASE_URL}/media/reports/${SECOND_PHOTO}.jpg`;

function entry(rig: FlagRig, photo = FIRST_PHOTO) {
  return validateSite(rig.sites.feature(SITE)).properties.photo_flags?.find((flags) => flags.photo_id === photo);
}

// Yes votes from people 101 onwards back the site without reporting any photo.
async function backedBy(rig: FlagRig, voters: number): Promise<void> {
  const site = await rig.sites.get(SITE);
  const votes: Vote[] = Array.from({ length: voters }, (_unused, i) => ({ siteId: SITE, ...flagger(101 + i), choice: "confirm", votedAt: NOW }));
  site?.recordVotes(VoteTally.of(votes));
  if (site) {
    rig.sites.put(site);
  }
}

describe("one report per person per photo", () => {
  it("keeps only a person's latest report, so reporting again never adds to the count", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await rig.service.flag(request(flagger(1), { reason: "unrelated" }));
    const again = await rig.service.flag(request(flagger(1), { reason: "offensive" }));
    expect(again.photo).toEqual({ count: 1, warned: false, hidden: false });
    expect([...rig.flags.rows.values()].map((row) => row.reason)).toEqual(["offensive"]);
    expect(validatePhotoFlag(again)).toMatchObject({ reason: "offensive", text_status: "none", moderation: null });
  });

  it("counts two accounts on one phone once", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await rig.service.flag(request(flagger(1)));
    const shared = await rig.service.flag(request({ userId: "user-second-account", deviceToken: flagger(1).deviceToken }));
    expect(shared.photo.count).toBe(1);
  });

  it("stores hashes only, never the user id or the device token", async () => {
    const rig = flagRig();
    seeded(rig, true);
    const answer = await rig.service.flag(request(flagger(1)));
    const stored = JSON.stringify([...rig.flags.rows.values()]) + JSON.stringify(answer) + JSON.stringify(rig.sites.feature(SITE));
    expect(stored).not.toContain(flagger(1).userId);
    expect(stored).not.toContain(flagger(1).deviceToken);
  });
});

describe("no self-reporting", () => {
  it.each([
    ["the same user on another phone", { userId: userOf(DEVICE_A), deviceToken: flagger(9).deviceToken }],
    ["another account on the same phone", { userId: "user-other", deviceToken: DEVICE_A }],
  ])("refuses %s with own_photo and records nothing", async (_name, person) => {
    const rig = flagRig();
    seeded(rig, true);
    const refused = rig.service.flag(request(person));
    await expect(refused).rejects.toThrow(OwnPhotoError);
    await expect(rig.service.flag(request(person))).rejects.toMatchObject({ status: 403, code: "own_photo" });
    expect(rig.flags.rows.size).toBe(0);
  });

  it("lets the reporter of one photo report another photo of the same site", async () => {
    const rig = flagRig();
    seeded(rig, true);
    const answer = await rig.service.flag(request({ userId: userOf(DEVICE_B), deviceToken: DEVICE_B }));
    expect(answer.photo.count).toBe(1);
  });
});

describe("thresholds", () => {
  it("defaults PHOTO_FLAG_WARN, PHOTO_FLAG_HIDE, PHOTO_FLAG_HIDE_EARLY and PHOTO_FLAG_SURPLUS to the decision's numbers", () => {
    expect([RULES.flags.warn, RULES.flags.hide, RULES.flags.hideEarly, RULES.flags.surplus]).toEqual([3, 8, 5, 5]);
  });

  it("warns at 3 people and hides at 8 when the site is well backed", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await backedBy(rig, 5);
    await flagBy(rig, 1, 2);
    expect(entry(rig)).toEqual({ photo_id: FIRST_PHOTO, count: 2, warned: false, hidden: false });
    await flagBy(rig, 3, 3);
    expect(entry(rig)).toEqual({ photo_id: FIRST_PHOTO, count: 3, warned: true, hidden: false });
    await flagBy(rig, 4, 7);
    expect(entry(rig)).toMatchObject({ count: 7, warned: true, hidden: false });
    expect(validateSite(rig.sites.feature(SITE)).properties.photo_urls).toContain(FIRST_URL);
    await flagBy(rig, 8, 8);
    const properties = validateSite(rig.sites.feature(SITE)).properties;
    expect(entry(rig)).toMatchObject({ count: 8, warned: true, hidden: true });
    expect(properties.photo_urls).toEqual([SECOND_URL]);
    expect(properties.status).toBe("open");
  });

  it("hides at 5 when the reports exceed the photo's other backers by 5", async () => {
    const rig = flagRig();
    seeded(rig, true);
    // DEVICE_B's photo is the only other backer, so 5 reports are a surplus of 4.
    await flagBy(rig, 1, 5);
    expect(entry(rig)).toMatchObject({ count: 5, hidden: false });
    await flagBy(rig, 6, 6);
    expect(entry(rig)).toMatchObject({ count: 6, hidden: true });
  });

  it("follows the surplus rule exactly", () => {
    const policy = new PhotoFlagPolicy(RULES.flags);
    expect(policy.state(4, 0, false).hidden).toBe(false);
    expect(policy.state(5, 0, false).hidden).toBe(true);
    expect(policy.state(5, 1, false).hidden).toBe(false);
    expect(policy.state(7, 3, false).hidden).toBe(false);
    expect(policy.state(8, 30, false).hidden).toBe(true);
    expect(policy.state(1, 0, true)).toEqual({ count: 1, warned: true, hidden: true });
  });

  it("keeps a hidden photo hidden when more people back the site later", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await flagBy(rig, 1, 6);
    await backedBy(rig, 9);
    await rig.service.flag(request(flagger(7), { reason: "duplicate" }));
    expect(entry(rig)).toMatchObject({ count: 7, hidden: true });
  });
});

describe("removing a site whose only photo is hidden", () => {
  it("removes an unverified one-photo site with photos_reported and keeps the copy for the audit trail", async () => {
    const rig = flagRig();
    seeded(rig);
    // 5 reports hide the photo, but the site goes only when they exceed all 1 backer by 5.
    await flagBy(rig, 1, 5);
    expect(validateSite(rig.sites.feature(SITE)).properties).toMatchObject({ status: "open", photo_urls: [] });
    expect(entry(rig)).toMatchObject({ count: 5, hidden: true });
    await flagBy(rig, 6, 6);
    const stored = validateSite(rig.sites.feature(SITE)).properties;
    expect(stored).toMatchObject({ status: "removed", removed_reason: "photos_reported", removed_at: "2026-10-10T06:00:00Z", photo_urls: [] });
    expect(rig.sites.internals(SITE)?.reports.map((report) => report.reportId)).toEqual([FIRST_PHOTO]);
    expect((await new SiteFinder(rig.sites, new NgeohashCells(), new FixedClock()).byId(SITE)).properties.status).toBe("removed");
    await expect(rig.service.flag(request(flagger(7)))).rejects.toThrow(NotFoundError);
  });

  it("keeps a site that still has another photo", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await flagBy(rig, 1, 8);
    expect(validateSite(rig.sites.feature(SITE)).properties).toMatchObject({ status: "open", photo_urls: [SECOND_URL] });
  });

  it("removes the site once every photo on it is hidden", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await flagBy(rig, 1, 8);
    const last = await rig.service.flag(request(flagger(9), { photo: SECOND_PHOTO }));
    expect(last.site_status).toBe("open");
    // DEVICE_A's photo still backs the site, so 6 reports are the surplus that hides it.
    await flagBy(rig, 10, 14, SECOND_PHOTO);
    expect(validateSite(rig.sites.feature(SITE)).properties).toMatchObject({ status: "removed", removed_reason: "photos_reported" });
  });

  it("keeps a verified site and hides only the photo", async () => {
    const rig = flagRig();
    seeded(rig);
    await backedBy(rig, 9);
    expect(validateSite(rig.sites.feature(SITE)).properties.verification).toBe("verified");
    await flagBy(rig, 1, 8);
    expect(validateSite(rig.sites.feature(SITE)).properties).toMatchObject({ status: "open", photo_urls: [] });
    expect(entry(rig)).toMatchObject({ hidden: true });
  });
});

describe("the description", () => {
  it("moderates it like a note, stores a clean one and starts the community analysis", async () => {
    const rig = flagRig();
    seeded(rig, true);
    const answer = await rig.service.flag(request(flagger(1), { text: "This is a different street, not this plot." }));
    expect(rig.moderator.seen).toEqual(["This is a different street, not this plot."]);
    expect(answer).toMatchObject({ text_status: "shown", moderation: { result: "clean", provider: "bedrock" } });
    expect([...rig.flags.rows.values()][0]).toMatchObject({ textStatus: "shown", text: "This is a different street, not this plot." });
    // One person's description is not a signal yet: the photo is not warned.
    expect(rig.community.sites).toEqual([]);
    expect(JSON.stringify(answer)).not.toContain("different street");
  });

  it("hides a flagged description without storing it, and the report still counts", async () => {
    const rig = flagRig();
    seeded(rig, true);
    rig.moderator.verdict = REMOVED;
    const answer = await rig.service.flag(request(flagger(1), { text: "call 9876543210" }));
    expect(answer).toMatchObject({ text_status: "hidden", photo: { count: 1 } });
    expect([...rig.flags.rows.values()][0]).toMatchObject({ textStatus: "hidden", text: null });
    expect(rig.community.sites).toEqual([]);
  });

  it("skips moderation without a description", async () => {
    const rig = flagRig();
    seeded(rig, true);
    await rig.service.flag(request(flagger(1)));
    expect(rig.moderator.seen).toEqual([]);
  });
});

describe("limits and missing photos", () => {
  it("refuses more than the hourly limit before moderating or storing anything", async () => {
    const rig = flagRig(2);
    seeded(rig, true);
    await rig.service.flag(request(flagger(1)));
    await rig.service.flag(request(flagger(1), { photo: SECOND_PHOTO }));
    await expect(rig.service.flag(request(flagger(1), { text: "again" }))).rejects.toThrow(RateLimitedError);
    expect(rig.moderator.seen).toEqual([]);
    expect(rig.flags.rows.size).toBe(2);
  });

  it.each([
    ["an unknown site", "site_none", FIRST_PHOTO],
    ["a photo that is not on the site", SITE, "rpt_elsewhere"],
  ])("answers 404 for %s", async (_name, siteId, photoId) => {
    const rig = flagRig();
    seeded(rig, true);
    await expect(rig.service.flag({ ...request(flagger(1)), siteId, photoId })).rejects.toThrow(NotFoundError);
  });
});
