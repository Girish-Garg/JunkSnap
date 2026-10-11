import { describe, expect, it } from "vitest";
import { InProcessMergeLock } from "../../src/adapters/sites/InProcessMergeLock.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { RecentSitesRepository } from "../../src/adapters/sites/RecentSitesRepository.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { MergeLock } from "../../src/ports/sites/MergeLock.js";
import type { SiteRepository } from "../../src/ports/sites/SiteRepository.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { BASE_LAT, BASE_LON, BASE_URL, evidence, northOf, report, type PhotoEvidence } from "./builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock } from "./fakes.js";
import { QUEUE, RULES, SCORES } from "../defaults.js";

// Field case on demo: two phones on 3G flush their outboxes together, SqsQueuePoller handles the batch with
// Promise.all, and both reports of one spot found a site (3 s apart, 3.4 m apart).

// The by-geohash index before it has caught up: a query returns nothing.
class LaggingIndexSites extends FakeSiteRepository {
  override async inCell(): Promise<Site[]> {
    return [];
  }
}

// The old merger: no lock, every report picks on its own.
class NoLock implements MergeLock {
  hold<T>(_keys: readonly string[], body: () => Promise<T>): Promise<T> {
    return body();
  }
}

function merger(sites: SiteRepository, lock: MergeLock = new InProcessMergeLock()): SiteMerger {
  return new SiteMerger({
    sites,
    lock,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(new FakeEmbeddings(), RULES),
    reports: new FakeReportStatus(),
    scores: new FakeScoreSeeder(),
    clock: new FixedClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia(BASE_URL)),
    retry: new ConflictRetry(QUEUE.mergeAttempts),
    rules: RULES,
    minVerifiedReports: SCORES.minVerifiedReports,
  });
}

// Two people's photos of one dump, 3.4 m apart.
const FIRST = evidence({ id: "first", device: "device-first", user: "user-first" });
const SECOND = evidence({ id: "second", device: "device-second", user: "user-second", lat: northOf(3.4) });
// Jaipur, another geohash4 cell.
const ELSEWHERE = evidence({ id: "jaipur", device: "device-jaipur", user: "user-jaipur", lat: 26.9124, lon: 75.7873 });

const together = (target: SiteMerger, ...reports: readonly PhotoEvidence[]) => Promise.all(reports.map((report) => target.merge(report)));

describe("the race between two reports of one spot", () => {
  it("is real without the lock: both pick nothing and both found a site", async () => {
    const sites = new FakeSiteRepository();
    await together(merger(sites, new NoLock()), FIRST, SECOND);
    expect(sites.count()).toBe(2);
  });

  it("is real one after the other too while the index lags, without the memory of new sites", async () => {
    const sites = new LaggingIndexSites();
    const plain = merger(sites);
    await plain.merge(FIRST);
    await plain.merge(SECOND);
    expect(sites.count()).toBe(2);
  });

  it("ends in one site with two reports when both are merged at once", async () => {
    const sites = new FakeSiteRepository();
    const results = await together(merger(sites), FIRST, SECOND);
    expect(results.map((result) => result.outcome).sort()).toEqual(["founded", "merged"]);
    expect(sites.count()).toBe(1);
    expect(sites.feature("site_first").properties).toMatchObject({ report_count: 2, backers: { count: 2 } });
  });

  it("ends in one site even when the index has not caught up with the first", async () => {
    const stored = new LaggingIndexSites();
    await together(merger(new RecentSitesRepository(stored, new NgeohashCells())), FIRST, SECOND);
    expect(stored.count()).toBe(1);
    expect(stored.feature("site_first").properties.report_count).toBe(2);
  });

  it("stays idempotent when the batch is delivered again", async () => {
    const stored = new LaggingIndexSites();
    const target = merger(new RecentSitesRepository(stored, new NgeohashCells()));
    await together(target, FIRST, SECOND);
    const again = await together(target, SECOND, FIRST);
    expect(again.map((result) => [result.siteId, result.outcome])).toEqual([["site_first", "unchanged"], ["site_first", "unchanged"]]);
    expect(stored.count()).toBe(1);
    expect(stored.feature("site_first").properties.report_count).toBe(2);
  });
});

// The index query of one cell waits until the test opens the gate.
class GatedSites extends FakeSiteRepository {
  readonly #cell: string;
  #open: () => void = () => undefined;
  readonly #gate = new Promise<void>((resolve) => {
    this.#open = resolve;
  });

  constructor(cell: string) {
    super();
    this.#cell = cell;
  }

  open(): void {
    this.#open();
  }

  override async inCell(cell: string): Promise<Site[]> {
    if (cell === this.#cell) {
      await this.#gate;
    }
    return super.inCell(cell);
  }
}

describe("reports at different spots", () => {
  it("merge side by side: a report in another cell finishes while one in Jodhpur waits", async () => {
    const sites = new GatedSites(new NgeohashCells().cellOf(new GeoPoint(BASE_LAT, BASE_LON)));
    const target = merger(sites);
    const waiting = target.merge(FIRST);
    expect(await target.merge(ELSEWHERE)).toMatchObject({ siteId: "site_jaipur", outcome: "founded" });
    sites.open();
    expect(await waiting).toMatchObject({ siteId: "site_first", outcome: "founded" });
  });

  it("wait their turn in one cell, and the lock is free again after a failure", async () => {
    const lock = new InProcessMergeLock();
    const order: string[] = [];
    const failing = lock.hold(["tsk8"], async () => {
      order.push("first");
      throw new Error("DynamoDB timed out");
    });
    const next = lock.hold(["tsk8"], async () => order.push("second"));
    await expect(failing).rejects.toThrow(/timed out/);
    await next;
    expect(order).toEqual(["first", "second"]);
    expect(await lock.hold(["tsk8"], async () => "free")).toBe("free");
  });

  it("never deadlock when two holders name the same cells in another order", async () => {
    const lock = new InProcessMergeLock();
    const both = await Promise.all([
      lock.hold(["tsk8", "tsk9"], async () => "a"),
      lock.hold(["tsk9", "tsk8"], async () => "b"),
      lock.hold(["tsk9"], async () => "c"),
    ]);
    expect(both).toEqual(["a", "b", "c"]);
  });
});

// The index catches up when the test says so; reads by id are counted.
class CatchingUpSites extends FakeSiteRepository {
  caughtUp = false;
  reads = 0;

  override async get(siteId: string): Promise<Site | null> {
    this.reads += 1;
    return super.get(siteId);
  }

  override async inCell(cell: string): Promise<Site[]> {
    return this.caughtUp ? super.inCell(cell) : [];
  }
}

describe("RecentSitesRepository", () => {
  it("shows a site it created by a consistent read until the index returns it, then forgets it", async () => {
    const stored = new CatchingUpSites();
    const cells = new NgeohashCells();
    const sites = new RecentSitesRepository(stored, cells);
    const site = Site.found(report(), RULES);
    const cell = cells.cellOf(site.point);
    expect(await sites.create(site)).toBe(true);

    expect((await sites.inCell(cell)).map((shown) => shown.siteId)).toEqual(["site_jdh_1"]);
    expect(stored.reads).toBe(1);
    stored.caughtUp = true;
    expect((await sites.inCell(cell)).map((shown) => shown.siteId)).toEqual(["site_jdh_1"]);
    stored.caughtUp = false;
    expect(await sites.inCell(cell)).toEqual([]);
    expect(stored.reads).toBe(1);
  });

  it("remembers nothing it did not create", async () => {
    const stored = new CatchingUpSites();
    const sites = new RecentSitesRepository(stored, new NgeohashCells());
    stored.put(Site.found(report(), RULES));
    expect(await sites.create(Site.found(report(), RULES))).toBe(false);
    expect(await sites.inCell(new NgeohashCells().cellOf(new GeoPoint(BASE_LAT, BASE_LON)))).toEqual([]);
  });
});
