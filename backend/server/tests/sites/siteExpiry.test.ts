import { describe, expect, it } from "vitest";
import { DynamoSiteExpirer } from "../../src/adapters/DynamoSiteExpirer.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { validateSite } from "../../src/contracts/index.gen.js";
import { ExternalServiceError, NotFoundError } from "../../src/domain/errors.js";
import { isLapsed } from "../../src/domain/SiteExpiry.js";
import { BoundingBox } from "../../src/domain/sites/BoundingBox.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import { SiteExpiredError } from "../../src/domain/sites/SiteErrors.js";
import type { Clock } from "../../src/ports/sites/Clock.js";
import type { ModerationResult, VerificationResult } from "../../src/contracts/index.gen.js";
import type { Vote } from "../../src/domain/sites/VoteTally.js";
import { CleanupIntake } from "../../src/services/sites/CleanupIntake.js";
import { CleanupService } from "../../src/services/sites/CleanupService.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { VoteService } from "../../src/services/sites/VoteService.js";
import { BASE_LAT, BASE_LON, BASE_URL, DEVICE_B, evidence, fixture, northOf, report, siteFixture } from "./builders.js";
import { FakeCleanups, FakeEmbeddings, FakeQueue, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository } from "./fakes.js";
import { conditionFailed, failure, ScriptedClient } from "./ScriptedClient.js";
import { PAGING, RETRY, RULES, SCORES } from "../defaults.js";

const SITE = "site_jdh_1";
// The jdh-1 report's capture time, the site's last activity.
const FOUNDED = Date.parse("2026-10-10T02:14:05Z");
const AROUND = BoundingBox.parse(`${BASE_LON - 0.01},${BASE_LAT - 0.01},${BASE_LON + 0.01},${BASE_LAT + 0.01}`, PAGING.bboxMaxDegrees);
const NEARBY = new GeoPoint(northOf(200), BASE_LON);
const day = (days: number, from = FOUNDED) => new Date(from + days * 86_400_000);

class SetClock implements Clock {
  at = new Date(FOUNDED);

  now(): Date {
    return this.at;
  }
}

function setup() {
  const sites = new FakeSiteRepository();
  sites.put(Site.found(report(), RULES));
  const clock = new SetClock();
  const retry = new ConflictRetry(RETRY.saveAttempts);
  const finder = new SiteFinder(sites, new NgeohashCells(), clock, PAGING.mapMaxSites);
  const [ballots, cleanups] = [new FakeVoteRepository(), new FakeCleanups()];
  const votes = new VoteService({ sites, votes: ballots, reports: new FakeReportStatus(), clock, retry });
  const intake = new CleanupIntake({ sites, cleanups, queue: new FakeQueue(), clock, retry });
  const service = new CleanupService({ sites, cleanups, votes: ballots, media: new PublicMedia(BASE_URL), retry });
  const listedOn = async (when: Date) => {
    clock.at = when;
    return (await finder.inBox(AROUND)).map((feature) => feature.properties.site_id);
  };
  const vote = (when: Date) => {
    clock.at = when;
    return votes.cast(SITE, { deviceToken: DEVICE_B, userId: "voter", choice: "confirm", point: NEARBY });
  };
  // An after-photo sent on the given day; the models pass it or not.
  const cleanupPhoto = async (when: Date, passes: boolean) => {
    clock.at = when;
    const request = { upload_id: `upl_${when.getTime()}`, device_token: DEVICE_B, sha256: "a".repeat(64), gps: { lat: BASE_LAT, lon: BASE_LON, accuracy_m: 8 }, captured_at: when.toISOString() };
    const { cleanup_id: id } = await intake.submit(SITE, request, "cleaner");
    const results = { moderation: { ...MODERATION, report_id: id }, verification: { ...VERIFICATION, report_id: id } };
    return service.apply(id, passes ? results : { moderation: null, verification: null });
  };
  return { sites, clock, finder, intake, listedOn, vote, cleanupPhoto };
}

const MODERATION = fixture<ModerationResult>("moderation_result.jdh-3.json");
const VERIFICATION = fixture<VerificationResult>("verification_result.jdh-3.json");

// The scores CronJob marks the site expired between the vote's check and its count.
class CronRacingVotes extends FakeVoteRepository {
  readonly #sites: FakeSiteRepository;

  constructor(sites: FakeSiteRepository) {
    super();
    this.#sites = sites;
  }

  override async put(vote: Vote): Promise<void> {
    await super.put(vote);
    const site = await this.#sites.get(SITE);
    site?.expireIfLapsed(day(200));
    if (site) {
      await this.#sites.save(site);
    }
  }
}

describe("site expiry (decision 20261010-1855)", () => {
  it("is 90 days", () => {
    expect(RULES.ttlDays).toBe(90);
  });

  it("keeps a site on the map 89 days after its last activity and drops it at 91, while its page says expired", async () => {
    const { finder, listedOn, sites } = setup();
    expect(validateSite(sites.feature(SITE)).properties.expires_at).toBe(day(90).toISOString());
    expect(await listedOn(day(89))).toEqual([SITE]);
    expect(await listedOn(day(91))).toEqual([]);
    expect((await finder.byId(SITE)).properties.status).toBe("expired");
    expect(sites.feature(SITE).properties.status).toBe("open");
  });

  it("is refreshed by any vote", async () => {
    const { vote, listedOn, sites } = setup();
    await vote(day(80));
    expect(sites.feature(SITE).properties.expires_at).toBe(day(170).toISOString());
    expect(await listedOn(day(169))).toEqual([SITE]);
    expect(await listedOn(day(171))).toEqual([]);
  });

  it("is refreshed by a new report merged in", async () => {
    const { sites, listedOn } = setup();
    const site = await sites.get(SITE);
    site?.merge(report({ id: "jdh_1b", device: DEVICE_B, lat: northOf(5), capturedAt: day(80).toISOString() }));
    if (site) {
      await sites.save(site);
    }
    expect(await listedOn(day(100))).toEqual([SITE]);
    expect(sites.feature(SITE).properties.expires_at).toBe(day(170).toISOString());
  });

  it("is refreshed by an accepted cleanup photo, never by a rejected one", async () => {
    const { cleanupPhoto, sites } = setup();
    expect(await cleanupPhoto(day(30), false)).toBe("rejected");
    expect(sites.feature(SITE).properties.expires_at).toBe(day(90).toISOString());
    expect(await cleanupPhoto(day(60), true)).toBe("accepted");
    expect(sites.feature(SITE).properties.expires_at).toBe(day(150).toISOString());
  });

  it("shows a row stored before the decision with the expiry its last report sets", async () => {
    const { sites, finder } = setup();
    const stored = siteFixture("jdh-2");
    expect(stored.properties.expires_at).toBeUndefined();
    sites.putFeature(stored);
    const shown = (await finder.byId(stored.properties.site_id)).properties;
    expect(shown.expires_at).toBe(new Date(Date.parse(stored.properties.last_reported_at) + 90 * 86_400_000).toISOString());
  });

  it("answers 404 to a vote whose site the CronJob marked expired before the vote was counted", async () => {
    const sites = new FakeSiteRepository();
    sites.put(Site.found(report(), RULES));
    const clock = new SetClock();
    clock.at = day(89);
    const voting = new VoteService({ sites, votes: new CronRacingVotes(sites), reports: new FakeReportStatus(), clock, retry: new ConflictRetry(RETRY.saveAttempts) });
    const cast = voting.cast(SITE, { deviceToken: DEVICE_B, userId: "voter", choice: "confirm", point: NEARBY });
    await expect(cast).rejects.toThrow(SiteExpiredError);
    expect(sites.feature(SITE).properties.status).toBe("expired");
  });

  it("refuses votes and cleanup photos once expired, as not found", async () => {
    const { vote, clock, intake } = setup();
    await expect(vote(day(91))).rejects.toThrow(SiteExpiredError);
    await expect(vote(day(91))).rejects.toBeInstanceOf(NotFoundError);
    clock.at = day(91);
    const request = { upload_id: "upl_c2", device_token: DEVICE_B, sha256: "a".repeat(64), gps: { lat: BASE_LAT, lon: BASE_LON, accuracy_m: 8 }, captured_at: day(91).toISOString() };
    await expect(intake.submit(SITE, request, "cleaner")).rejects.toThrow(SiteExpiredError);
  });

  it("starts a fresh site for a new report at an expired spot, and the old one keeps its history", async () => {
    const { sites } = setup();
    const merger = new SiteMerger({
      sites,
      votes: new FakeVoteRepository(),
      cells: new NgeohashCells(),
      picker: new MergeTargetPicker(new FakeEmbeddings(), RULES.mergeMinCosine),
      reports: new FakeReportStatus(),
      scores: new FakeScoreSeeder(),
      clock: new SetClock(),
      reportFactory: new MergeableReportFactory(new PublicMedia(BASE_URL)),
      retry: new ConflictRetry(RETRY.saveAttempts),
      rules: RULES,
      minVerifiedReports: SCORES.minVerifiedReports,
    });
    const early = await merger.merge(evidence({ id: "jdh_2", device: DEVICE_B, capturedAt: day(89).toISOString() }));
    expect(early.siteId).toBe(SITE);
    const late = await merger.merge(evidence({ id: "jdh_3", device: DEVICE_B, capturedAt: day(180).toISOString() }));
    expect(late).toMatchObject({ siteId: "site_jdh_3", outcome: "founded" });
    expect(sites.feature(SITE).properties).toMatchObject({ report_count: 2, expires_at: day(179).toISOString() });
  });

  it("never expires a cleaned, removed or rejected site, and an expired one stays expired", () => {
    const base = { verification: "unverified", last_reported_at: "2026-01-01T00:00:00Z" };
    const now = new Date("2026-10-10T00:00:00Z");
    expect(isLapsed({ ...base, status: "open" }, now, RULES.ttlDays)).toBe(true);
    expect(isLapsed({ ...base, status: "reopened" }, now, RULES.ttlDays)).toBe(true);
    expect(isLapsed({ ...base, status: "cleaned" }, now, RULES.ttlDays)).toBe(false);
    expect(isLapsed({ ...base, status: "removed" }, now, RULES.ttlDays)).toBe(false);
    expect(isLapsed({ ...base, status: "open", verification: "rejected" }, now, RULES.ttlDays)).toBe(false);
    expect(isLapsed({ ...base, status: "expired", expires_at: "2027-01-01T00:00:00Z" }, now, RULES.ttlDays)).toBe(true);
  });
});

describe("DynamoSiteExpirer", () => {
  const now = new Date("2026-10-20T00:00:00.000Z");
  // A row written before decision 20261010-1855: no expires_at.
  const legacyRow = (lastReportedAt: string) => () => ({ Item: { status: "open", verification: "unverified", last_reported_at: lastReportedAt } });

  it("marks the site expired only while it is still lapsed, and bumps its version", async () => {
    const row = { status: "open", verification: "unverified", last_reported_at: "2026-07-01T00:00:00Z", expires_at: "2026-09-29T00:00:00.000Z" };
    const client = new ScriptedClient([() => ({ Item: row })]);
    expect(await new DynamoSiteExpirer(client.as<DynamoDBDocumentClient>(), "junksnap-dev-sites", RULES.ttlDays).expire(SITE, now)).toBe(true);
    expect(client.sent.map((command) => command.name)).toEqual(["GetCommand", "UpdateCommand"]);
    expect(client.sent[0]?.input).toMatchObject({ TableName: "junksnap-dev-sites", Key: { site_id: SITE } });
    const input = client.sent[1]?.input;
    expect(input).toMatchObject({ TableName: "junksnap-dev-sites", Key: { site_id: SITE }, ExpressionAttributeNames: { "#status": "status" } });
    expect(input?.UpdateExpression).toContain("version = if_not_exists(version, :zero) + :one");
    expect(input?.ConditionExpression).toContain("expires_at < :now");
    expect(input?.ExpressionAttributeValues).toMatchObject({ ":expired": "expired", ":now": now.toISOString(), ":seen": "2026-07-01T00:00:00Z" });
  });

  it("judges a row without expires_at by Date.parse, so an offset in last_reported_at neither delays nor hastens it", async () => {
    // 05:00+05:30 on 22 Jul is 23:30Z on 21 Jul, past the 22 Jul 00:00Z cutoff, though it sorts after it as text.
    const lapsed = new ScriptedClient([legacyRow("2026-07-22T05:00:00+05:30")]);
    expect(await new DynamoSiteExpirer(lapsed.as<DynamoDBDocumentClient>(), "t", RULES.ttlDays).expire(SITE, now)).toBe(true);
    const update = lapsed.sent.find((command) => command.name === "UpdateCommand")?.input;
    expect(update?.ConditionExpression).toContain("attribute_not_exists(expires_at) AND last_reported_at = :seen");
    expect(update?.ExpressionAttributeValues).toMatchObject({ ":seen": "2026-07-22T05:00:00+05:30" });
    // 22:00-04:00 on 21 Jul is 02:00Z on 22 Jul, not lapsed yet, though it sorts before the cutoff as text.
    const fresh = new ScriptedClient([legacyRow("2026-07-21T22:00:00-04:00")]);
    expect(await new DynamoSiteExpirer(fresh.as<DynamoDBDocumentClient>(), "t", RULES.ttlDays).expire(SITE, now)).toBe(false);
    expect(fresh.sent.map((command) => command.name)).toEqual(["GetCommand"]);
  });

  it("answers false when a vote refreshed the site meanwhile, and wraps other failures", async () => {
    const refreshed = new ScriptedClient([legacyRow("2026-07-01T00:00:00Z"), conditionFailed]);
    expect(await new DynamoSiteExpirer(refreshed.as<DynamoDBDocumentClient>(), "t", RULES.ttlDays).expire(SITE, now)).toBe(false);
    const down = new ScriptedClient([legacyRow("2026-07-01T00:00:00Z"), failure("InternalServerError")]);
    await expect(new DynamoSiteExpirer(down.as<DynamoDBDocumentClient>(), "t", RULES.ttlDays).expire(SITE, now)).rejects.toThrow(ExternalServiceError);
    const unreadable = new ScriptedClient([failure("InternalServerError")]);
    await expect(new DynamoSiteExpirer(unreadable.as<DynamoDBDocumentClient>(), "t", RULES.ttlDays).expire(SITE, now)).rejects.toThrow(ExternalServiceError);
  });
});
