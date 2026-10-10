import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { SiteItemMapper } from "../../src/adapters/sites/SiteItemMapper.js";
import { SiteItemParser } from "../../src/adapters/SiteItemParser.js";
import type { ModerationResult, VerificationResult } from "../../src/contracts/index.gen.js";
import { validateSite } from "../../src/contracts/index.gen.js";
import { AreaSites } from "../../src/domain/AreaSites.js";
import { BoundingBox } from "../../src/domain/sites/BoundingBox.js";
import { CLEANED_QUORUM } from "../../src/domain/sites/Clearance.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { VoteChoice } from "../../src/domain/sites/SiteTypes.js";
import type { Clock } from "../../src/ports/sites/Clock.js";
import { CleanupIntake } from "../../src/services/sites/CleanupIntake.js";
import { CleanupService } from "../../src/services/sites/CleanupService.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { VoteService } from "../../src/services/sites/VoteService.js";
import { BASE_LAT, BASE_LON, BASE_URL, fixture, northOf, report } from "./builders.js";
import { FakeCleanups, FakeQueue, FakeReportStatus, FakeSiteRepository, FakeVoteRepository, RecordingLogger } from "./fakes.js";

const SITE = "site_jdh_1";
const NEARBY = new GeoPoint(northOf(200), BASE_LON);
const AROUND = BoundingBox.parse(`${BASE_LON - 0.01},${BASE_LAT - 0.01},${BASE_LON + 0.01},${BASE_LAT + 0.01}`);
const MODERATION = fixture<ModerationResult>("moderation_result.jdh-3.json");
const VERIFICATION = fixture<VerificationResult>("verification_result.jdh-3.json");

// One minute later on every read, from 06:00 on 10 Oct; jump moves it on.
class StepClock implements Clock {
  #at = Date.UTC(2026, 9, 10, 6, 0);

  now(): Date {
    this.#at += 60_000;
    return new Date(this.#at);
  }

  jump(minutes: number): void {
    this.#at += minutes * 60_000;
  }
}

function setup() {
  const sites = new FakeSiteRepository();
  sites.put(Site.found(report()));
  const [votes, cleanups, clock, retry] = [new FakeVoteRepository(), new FakeCleanups(), new StepClock(), new ConflictRetry()];
  const voting = new VoteService({ sites, votes, reports: new FakeReportStatus(), clock, retry });
  const intake = new CleanupIntake({ sites, cleanups, queue: new FakeQueue(), clock, retry });
  const service = new CleanupService({ sites, cleanups, votes, media: new PublicMedia(BASE_URL), retry });
  const finder = new SiteFinder(sites, new NgeohashCells(), clock);
  let uploads = 0;
  // A person's after-photo that the models pass; the person is their user id.
  const photo = async (person: string, passes = true) => {
    uploads += 1;
    const request = { upload_id: `upl_${uploads}`, device_token: `device-${person}`, sha256: "a".repeat(64), gps: { lat: BASE_LAT, lon: BASE_LON, accuracy_m: 8 }, captured_at: "2026-10-10T06:00:00Z" };
    const { cleanup_id: id } = await intake.submit(SITE, request, person);
    const results = { moderation: { ...MODERATION, report_id: id }, verification: { ...VERIFICATION, report_id: id } };
    await service.apply(id, passes ? results : { moderation: null, verification: null });
  };
  const vote = (person: string, choice: VoteChoice) => voting.cast(SITE, { deviceToken: `device-${person}`, userId: person, choice, point: NEARBY });
  const props = () => validateSite(sites.feature(SITE)).properties;
  return { sites, clock, finder, intake, service, photo, vote, props };
}

describe("cleared by several people (decision 20261010-1855)", () => {
  it("needs 3 people", () => {
    expect(CLEANED_QUORUM).toBe(3);
  });

  it("keeps the site on the map after one after-photo, pending 1 of 3", async () => {
    const { finder, photo, props } = setup();
    await photo("p1");
    expect(props()).toMatchObject({ status: "open", cleanup_status: "pending_confirmation", clearance: { count: 1, needed: 3, still_there: 0 } });
    const listed = await finder.inBox(AROUND);
    expect(listed.map((feature) => feature.properties.clearance)).toEqual([{ count: 1, needed: 3, still_there: 0 }]);
  });

  it("clears it once 3 different people say so, by photo and by vote, and it leaves the map", async () => {
    const { finder, photo, vote, props } = setup();
    await photo("p1");
    await vote("p2", "cleaned");
    expect(props()).toMatchObject({ status: "open", clearance: { count: 2, needed: 3 } });
    await vote("p3", "cleaned");
    expect(props()).toMatchObject({ status: "cleaned", cleaned_by: "after_photo", cleanup_status: "accepted", cleaned_at: "2026-10-10T06:03:00.000Z" });
    expect(await finder.inBox(AROUND)).toEqual([]);
    expect((await finder.byId(SITE)).properties.status).toBe("cleaned");
  });

  it("clears it with three people's after-photos alone", async () => {
    const { photo, props } = setup();
    await photo("p1");
    await photo("p2");
    await photo("p3");
    expect(props()).toMatchObject({ status: "cleaned", cleaned_by: "after_photo", clearance: { count: 3, needed: 3 } });
  });

  it("counts the same person once, however many photos and cleared votes they send", async () => {
    const { photo, vote, props, sites } = setup();
    await photo("p1");
    await photo("p1");
    await vote("p1", "cleaned");
    expect(props()).toMatchObject({ status: "open", clearance: { count: 1, needed: 3 } });
    expect(sites.internals(SITE)?.cleanupPeople).toHaveLength(1);
    await vote("p2", "cleaned");
    expect(props()).toMatchObject({ status: "open", clearance: { count: 2, needed: 3 } });
  });

  it("lets still-there votes hold it: cleared people must lead by 3", async () => {
    const { photo, vote, props } = setup();
    await photo("p1");
    await vote("p2", "cleaned");
    await vote("p3", "confirm");
    await vote("p4", "cleaned");
    expect(props()).toMatchObject({ status: "open", clearance: { count: 3, needed: 4, still_there: 1 } });
    await vote("p5", "cleaned");
    expect(props()).toMatchObject({ status: "cleaned", clearance: { count: 4, needed: 4, still_there: 1 } });
  });

  it("drops an uploader who later says still there", async () => {
    const { photo, vote, props } = setup();
    await photo("p1");
    await vote("p1", "confirm");
    expect(props()).toMatchObject({ clearance: { count: 0, needed: 3, still_there: 0 } });
  });

  it("starts again after a new waste photo: earlier words no longer count", async () => {
    const { sites, clock, photo, vote, props } = setup();
    await photo("p1");
    await vote("p2", "cleaned");
    const site = await sites.get(SITE);
    site?.merge(report({ id: "jdh_1r", device: "5b1d3c2e-7f4a-4e6b-8c9d-0a1b2c3d4e5f", lat: northOf(5), capturedAt: "2026-10-10T07:00:00Z" }));
    if (site) {
      await sites.save(site);
    }
    expect(props()).toMatchObject({ status: "open", cleanup_status: "none", clearance: { count: 0, needed: 3 } });
    clock.jump(120);
    await vote("p3", "cleaned");
    expect(props()).toMatchObject({ status: "open", clearance: { count: 1, needed: 3 } });
  });

  it("keeps a cleaned verified site in the scores as cleared, as before", async () => {
    const { sites, photo, vote } = setup();
    for (const n of [11, 12, 13, 14, 15, 16, 17, 18, 19]) {
      await vote(`v${n}`, "confirm");
    }
    await photo("p1");
    await photo("p2");
    await photo("p3");
    const stored = await sites.get(SITE);
    const item = stored === null ? {} : new SiteItemMapper(new NgeohashCells(), new RecordingLogger()).toItem(stored);
    const area = new SiteItemParser().parse(item);
    expect(area.everCleared()).toBe(true);
    expect(new AreaSites([area]).counts()).toMatchObject({ sites: 1, cleaned_sites: 1, open_sites: 0, verified_reports: 1 });
  });
});

describe("clearing edge cases (decision 20261010-1855)", () => {
  it("stays pending when a second person's photo is rejected, since the first one still counts", async () => {
    const { photo, props } = setup();
    await photo("p1");
    await photo("p2", false);
    expect(props()).toMatchObject({ status: "open", cleanup_status: "pending_confirmation", clearance: { count: 1 } });
  });

  it("says cleared by votes when the only after-photo came before the newest report", async () => {
    const { sites, clock, photo, vote, props } = setup();
    await photo("p1");
    const site = await sites.get(SITE);
    site?.merge(report({ id: "jdh_1r", device: "5b1d3c2e-7f4a-4e6b-8c9d-0a1b2c3d4e5f", lat: northOf(5), capturedAt: "2026-10-10T07:00:00Z" }));
    if (site) {
      await sites.save(site);
    }
    clock.jump(120);
    for (const person of ["p2", "p3", "p4"]) {
      await vote(person, "cleaned");
    }
    expect(props()).toMatchObject({ status: "cleaned", cleaned_by: "votes" });
  });

  it("rejects an after-photo that finishes after the site expired", async () => {
    const { sites, intake, service, props } = setup();
    const request = { upload_id: "upl_late", device_token: "device-p1", sha256: "a".repeat(64), gps: { lat: BASE_LAT, lon: BASE_LON, accuracy_m: 8 }, captured_at: "2026-10-10T06:00:00Z" };
    const { cleanup_id: id } = await intake.submit(SITE, request, "p1");
    const site = await sites.get(SITE);
    site?.expireIfLapsed(new Date("2027-06-01T00:00:00Z"));
    if (site) {
      await sites.save(site);
    }
    const results = { moderation: { ...MODERATION, report_id: id }, verification: { ...VERIFICATION, report_id: id } };
    expect(await service.apply(id, results)).toBe("rejected");
    expect(props().status).toBe("expired");
    expect(props().clearance).toBeUndefined();
  });
});
