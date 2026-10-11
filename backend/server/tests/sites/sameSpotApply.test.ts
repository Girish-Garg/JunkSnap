import { describe, expect, it } from "vitest";
import { GroupMerger } from "../../scripts/sameSpot/GroupMerger.js";
import { GroupPlanner } from "../../scripts/sameSpot/GroupPlanner.js";
import { SameSpotApply, type ApplySummary } from "../../scripts/sameSpot/SameSpotApply.js";
import { SameSpotGrouper } from "../../scripts/sameSpot/SameSpotGrouper.js";
import { SameSpotScan } from "../../scripts/sameSpot/SameSpotScan.js";
import { StoredReportEvidence } from "../../scripts/sameSpot/StoredReportEvidence.js";
import { validateSite } from "../../src/contracts/index.gen.js";
import type { ShownNote } from "../../src/domain/notes/Community.js";
import type { Report } from "../../src/domain/Report.js";
import type { ReportRecord } from "../../src/domain/ReportRecord.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { SiteProperties, Verification } from "../../src/domain/sites/SiteTypes.js";
import { VoteTally, type Vote } from "../../src/domain/sites/VoteTally.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { FakeReportRepository } from "../reportFakes.js";
import { BASE_URL, evidence, northOf, type EvidenceOptions, type PhotoEvidence } from "./builders.js";
import { FakeReportStatus, FakeSiteRepository, FakeVoteRepository, FixedClock, NOW } from "./fakes.js";
import { RETRY, RULES } from "../defaults.js";

// mergeSameSpotSites.ts --apply (decision 20261011-1730-hem-merged-sites) against the fakes.
const DAY_ONE = "2026-10-09T05:00:00Z";
const DAY_TWO = "2026-10-10T02:14:08Z";

class FakeNotes {
  readonly #notes = new Map<string, ShownNote[]>();

  add(siteId: string): void {
    this.#notes.set(siteId, [{ text: "It smells", authorHash: "a1b2" }]);
  }

  async shownFor(siteId: string): Promise<ShownNote[]> {
    return this.#notes.get(siteId) ?? [];
  }
}

// The report rows table goes down once, after the kept site was saved.
class FlakyReports extends FakeReportRepository {
  failures = 1;

  override async save(report: Report): Promise<void> {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error("DynamoDB timed out");
    }
    return super.save(report);
  }
}

// One person's photo `north` metres from BASE.
const photo = (id: string, north: number, capturedAt: string, extra: EvidenceOptions = {}): PhotoEvidence =>
  evidence({ id, device: `device-${id}`, user: `user-${id}`, lat: northOf(north), capturedAt, ...extra });

function rowOf(shot: PhotoEvidence, siteId: string): ReportRecord {
  const steps = ["moderate", "verify", "brands", "locate", "merge"] as const;
  const fields = { moderation_result: shot.moderation, verification_result: shot.verification, brand_labels: shot.brands, location: shot.location };
  const ids = { report_id: `rpt_${shot.upload.upload_id.slice(4)}`, site_id: siteId };
  return { ...shot.upload, ...fields, ...ids, received_at: NOW, updated_at: NOW, status: "unverified", completed_steps: steps, version: 1 };
}

// The live worker or api acts on the duplicate while the script runs, right after the script's first status write.
class RacyStatus extends FakeReportStatus {
  #race: (() => Promise<void>) | null = null;

  arm(race: () => Promise<void>): void {
    this.#race = race;
  }

  override async followSite(reportIds: readonly string[], status: Verification): Promise<void> {
    await super.followSite(reportIds, status);
    const race = this.#race;
    this.#race = null;
    await race?.();
  }
}

class World {
  readonly sites = new FakeSiteRepository();
  readonly votes = new FakeVoteRepository();
  readonly notes = new FakeNotes();
  readonly lines: string[] = [];
  readonly reports: FakeReportRepository;
  readonly statuses: FakeReportStatus;
  readonly #factory = new MergeableReportFactory(new PublicMedia(BASE_URL));

  constructor(reports = new FakeReportRepository(), statuses = new FakeReportStatus()) {
    this.reports = reports;
    this.statuses = statuses;
  }

  // The worker merges a new photo into a site, as SiteMerger does, and writes its row.
  async late(shot: PhotoEvidence, siteId: string): Promise<void> {
    const site = await this.sites.get(siteId);
    site?.merge(this.#factory.create(shot));
    if (site) await this.sites.save(site);
    this.reports.put(rowOf(shot, siteId));
  }

  // The api takes a vote on a site and recounts it, as VoteService does.
  async voteOn(siteId: string, cast: Vote): Promise<void> {
    await this.votes.put({ ...cast, siteId });
    const site = await this.sites.get(siteId);
    site?.recordVotes(VoteTally.of(await this.votes.forSite(siteId)));
    if (site) await this.sites.save(site);
  }

  // A site founded by the first photo with the others merged in, each with its report row.
  site(shots: readonly PhotoEvidence[], votes: readonly Vote[] = []): Site {
    const [first, ...rest] = shots.map((shot) => this.#factory.create(shot));
    if (first === undefined) throw new Error("a site needs a photo");
    const site = Site.found(first, RULES);
    rest.forEach((report) => site.merge(report));
    votes.forEach((vote) => void this.votes.put({ ...vote, siteId: site.siteId }));
    site.recordVotes(VoteTally.of(votes.map((vote) => ({ ...vote, siteId: site.siteId }))));
    this.sites.put(site);
    shots.forEach((shot) => this.reports.put(rowOf(shot, site.siteId)));
    return site;
  }

  change(siteId: string, change: Partial<SiteProperties>): void {
    const feature = this.sites.feature(siteId);
    this.sites.putFeature({ ...feature, properties: { ...feature.properties, ...change } }, this.sites.internals(siteId));
  }

  async run(): Promise<ApplySummary> {
    const findings = await new SameSpotScan(this.sites, new SameSpotGrouper(RULES.siteSameSpotM, new Date(NOW))).run();
    const print = (line: string) => this.lines.push(line);
    const { sites, reports, statuses, votes, notes } = this;
    const planner = new GroupPlanner({ sites, reports, notes, evidence: new StoredReportEvidence(this.#factory) });
    const retry = new ConflictRetry(RETRY.saveAttempts);
    const merger = new GroupMerger({ sites, reports, statuses, votes, retry, rules: RULES, clock: new FixedClock(), print });
    return new SameSpotApply(planner, merger, print).run(findings.groups);
  }
}

const vote = (device: string, choice: Vote["choice"], votedAt: string): Vote => ({ siteId: "", deviceToken: device, userId: null, choice, votedAt });

describe("mergeSameSpotSites --apply", () => {
  it("merges the field case into the older site, moves the row, removes the duplicate as merged, and is done after one run", async () => {
    const world = new World();
    world.site([photo("a", 0, DAY_ONE), photo("b", 0.5, DAY_ONE)]);
    world.site([photo("c", 0.8, DAY_TWO)]);

    expect(await world.run()).toEqual({ merged: 1, skipped: 0, leftOpen: 0 });

    const kept = world.sites.feature("site_a").properties;
    expect(kept).toMatchObject({ report_count: 3, backers: { count: 3, photo_people: 3 }, last_reported_at: DAY_TWO });
    expect(kept.photo_urls).toContain(`${BASE_URL}/media/reports/rpt_c.jpg`);
    const absorbed = validateSite(world.sites.feature("site_c")).properties;
    expect(absorbed).toMatchObject({ status: "removed", removed_reason: "merged", merged_into: "site_a", removed_at: NOW, report_count: 1 });
    expect(world.reports.stored("rpt_c")).toMatchObject({ site_id: "site_a", status: "unverified" });
    expect(world.lines.slice(-7)).toEqual([
      "merging site_c into site_a",
      "site_c: copied 0 of 0 votes to site_a",
      "site_a: merged 1 reports (0 already there); 2 reports, 2 of 10 backers, 0 corroborations, unverified -> 3 reports, 3 of 10 backers, 0 corroborations, unverified",
      "report rpt_c: site_id site_c -> site_a, status unverified",
      "site_c: copied 0 of 0 votes to site_a",
      "site_c: removed, removed_reason merged, merged_into site_a",
      "applied: 1 groups merged, 0 skipped, 0 left open for the next run",
    ]);

    const saves = world.sites.saves;
    expect(await world.run()).toEqual({ merged: 0, skipped: 0, leftOpen: 0 });
    expect(world.sites.saves).toBe(saves);
  });

  it("counts a Me too aimed at the duplicate as a corroboration of the kept site", async () => {
    const world = new World();
    world.site([photo("a", 0, DAY_ONE)]);
    world.site([photo("c", 1, DAY_TWO), photo("d", 1, DAY_TWO, { meToo: "site_c" })]);
    expect(world.sites.feature("site_c").properties.corroborations).toBe(1);
    await world.run();
    expect(world.sites.feature("site_a").properties).toMatchObject({ report_count: 3, corroborations: 1 });
  });

  it("copies the duplicate's votes, a device's newer vote winning, and verifies the kept site at 10 backers", async () => {
    const world = new World();
    const keptVotes = [vote("v1", "reject", "2026-10-10T04:00:00Z"), vote("v2", "reject", "2026-10-10T05:30:00Z")];
    world.site(["a1", "a2", "a3", "a4", "a5", "a6"].map((id, n) => photo(id, n, DAY_ONE)), keptVotes);
    const yes = ["v1", "v2", "v3", "v4"].map((device) => vote(device, "confirm", "2026-10-10T05:00:00Z"));
    world.site([photo("c", 1.5, DAY_TWO)], yes);

    await world.run();

    expect(world.sites.feature("site_a1").properties).toMatchObject({ verification: "verified", report_count: 7, verified_count: 7, backers: { count: 10 } });
    expect((await world.votes.forSite("site_a1")).map((stored) => [stored.deviceToken, stored.choice]).sort()).toEqual([
      ["v1", "confirm"], ["v2", "reject"], ["v3", "confirm"], ["v4", "confirm"],
    ]);
    expect(await world.votes.forSite("site_c")).toHaveLength(4);
    expect(world.statuses.statuses.get("rpt_a1")).toBe("verified");
    expect(world.reports.stored("rpt_c").status).toBe("verified");
    expect(world.lines).toContain("site_c: copied 3 of 4 votes to site_a1");
  });

  it("finishes a run that stopped halfway without merging any report twice", async () => {
    const world = new World(new FlakyReports());
    world.site([photo("a", 0, DAY_ONE)]);
    world.site([photo("c", 0.8, DAY_TWO)]);
    await expect(world.run()).rejects.toThrow(/timed out/);
    expect(world.sites.feature("site_a").properties.report_count).toBe(2);
    expect(world.sites.feature("site_c").properties.status).toBe("open");

    expect(await world.run()).toEqual({ merged: 1, skipped: 0, leftOpen: 0 });
    expect(world.lines).toContain("site_a: merged 0 reports (1 already there); 2 reports, 2 of 10 backers, 0 corroborations, unverified -> 2 reports, 2 of 10 backers, 0 corroborations, unverified");
    expect(world.sites.feature("site_a").properties.report_count).toBe(2);
    expect(world.sites.feature("site_c").properties).toMatchObject({ status: "removed", merged_into: "site_a" });
    expect(world.reports.stored("rpt_c").site_id).toBe("site_a");
    expect(await world.run()).toEqual({ merged: 0, skipped: 0, leftOpen: 0 });
  });
});

describe("mergeSameSpotSites --apply while the worker and api keep running", () => {
  it("leaves a duplicate open when the worker merges a new report into it during the run, and moves it on the next run", async () => {
    const statuses = new RacyStatus();
    const world = new World(new FakeReportRepository(), statuses);
    world.site([photo("a", 0, DAY_ONE)]);
    world.site([photo("c", 0.8, DAY_TWO)]);
    statuses.arm(() => world.late(photo("r", 1, "2026-10-10T05:00:00Z"), "site_c"));

    expect(await world.run()).toEqual({ merged: 0, skipped: 0, leftOpen: 1 });
    expect(world.sites.feature("site_c").properties).toMatchObject({ status: "open", report_count: 2 });
    expect(world.reports.stored("rpt_r").site_id).toBe("site_c");
    expect(world.lines).toContain("site_c: left open: it took rpt_r during this run; run again to move it");

    expect(await world.run()).toEqual({ merged: 1, skipped: 0, leftOpen: 0 });
    expect(world.sites.feature("site_a").properties).toMatchObject({ report_count: 3, backers: { count: 3 } });
    expect(world.sites.feature("site_c").properties).toMatchObject({ status: "removed", merged_into: "site_a" });
    expect(world.reports.stored("rpt_r").site_id).toBe("site_a");
    expect(await world.run()).toEqual({ merged: 0, skipped: 0, leftOpen: 0 });
  });

  it("copies a vote cast on the duplicate during the run and counts it on the kept site", async () => {
    const statuses = new RacyStatus();
    const world = new World(new FakeReportRepository(), statuses);
    world.site([photo("a", 0, DAY_ONE)]);
    world.site([photo("c", 0.8, DAY_TWO)]);
    statuses.arm(() => world.voteOn("site_c", vote("v9", "confirm", "2026-10-10T05:00:00Z")));

    expect(await world.run()).toEqual({ merged: 1, skipped: 0, leftOpen: 0 });
    expect((await world.votes.forSite("site_a")).map((stored) => stored.deviceToken)).toEqual(["v9"]);
    expect(world.sites.feature("site_a").properties).toMatchObject({ backers: { count: 3, vote_people: 1 }, votes: { confirm: 1 } });
    expect(world.lines).toContain("site_c: copied 1 of 1 votes to site_a");
    expect(world.lines).toContain("site_a: recounted the votes copied at the end; 2 reports, 3 of 10 backers, 1 corroborations, unverified");
    expect(world.sites.feature("site_c").properties.status).toBe("removed");
  });
});

describe("mergeSameSpotSites --apply leaves for a person", () => {
  it.each([
    ["has photo reports", (world: World) => world.change("site_c", { photo_flags: [{ photo_id: "rpt_c", count: 1, warned: false, hidden: false }] })],
    ["has a cleanup or cleared words", (world: World) => world.change("site_c", { cleanup_status: "checking" })],
    ["has residents' notes", (world: World) => world.notes.add("site_c")],
    ["report rpt_c of site_c belongs to site_other", (world: World) => world.reports.put({ ...world.reports.stored("rpt_c"), site_id: "site_other" })],
  ])("a group whose duplicate %s, and writes nothing", async (reason, arrange) => {
    const world = new World();
    world.site([photo("a", 0, DAY_ONE)]);
    world.site([photo("c", 0.8, DAY_TWO)]);
    arrange(world);
    expect(await world.run()).toEqual({ merged: 0, skipped: 1, leftOpen: 0 });
    expect(world.lines.find((line) => line.startsWith("skipped"))).toContain(reason);
    expect(world.sites.saves).toBe(0);
    expect(await world.votes.forSite("site_a")).toEqual([]);
  });

  it("a group whose duplicate holds a report the kept site would not accept", async () => {
    const world = new World();
    world.site([photo("a", 0, DAY_ONE)]);
    world.site([photo("c", 15, DAY_TWO), photo("e", 45, DAY_TWO)]);
    expect(await world.run()).toEqual({ merged: 0, skipped: 1, leftOpen: 0 });
    expect(world.lines).toContain("skipped the group of site_a: report rpt_e of site_c is 45 m from site_a, which does not accept it; merge it by hand");
    expect(world.sites.saves).toBe(0);
  });
});
