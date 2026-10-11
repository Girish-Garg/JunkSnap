import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { SiteItemMapper } from "../../src/adapters/sites/SiteItemMapper.js";
import { SiteItemParser } from "../../src/adapters/SiteItemParser.js";
import { validateSite } from "../../src/contracts/index.gen.js";
import { AreaSites } from "../../src/domain/AreaSites.js";
import { BoundingBox } from "../../src/domain/sites/BoundingBox.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { Site } from "../../src/domain/sites/Site.js";
import { AlreadyCleanedError } from "../../src/domain/sites/SiteErrors.js";
import type { VoteChoice } from "../../src/domain/sites/SiteTypes.js";
import type { Clock } from "../../src/ports/sites/Clock.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { VoteService } from "../../src/services/sites/VoteService.js";
import { BASE_LAT, BASE_LON, northOf, report } from "./builders.js";
import { FakeReportStatus, FakeSiteRepository, FakeVoteRepository, RecordingLogger } from "./fakes.js";
import { RULES } from "../defaults.js";

const SITE = "site_jdh_1";
const NEARBY = new GeoPoint(northOf(200), BASE_LON);
const AROUND = BoundingBox.parse(`${BASE_LON - 0.01},${BASE_LAT - 0.01},${BASE_LON + 0.01},${BASE_LAT + 0.01}`);

// One minute later on every read, so each vote has its own time.
class SteppingClock implements Clock {
  #minutes = 0;

  now(): Date {
    this.#minutes += 1;
    return new Date(Date.UTC(2026, 9, 10, 6, this.#minutes));
  }
}

function setup() {
  const sites = new FakeSiteRepository();
  sites.put(Site.found(report(), RULES));
  const reports = new FakeReportStatus();
  const service = new VoteService({ sites, votes: new FakeVoteRepository(), reports, clock: new SteppingClock(), retry: new ConflictRetry() });
  const finder = new SiteFinder(sites, new NgeohashCells(), new SteppingClock());
  let next = 1;
  const cast = async (choice: VoteChoice, count = 1) => {
    let result;
    for (let n = 0; n < count; n += 1, next += 1) {
      const device = `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
      result = await service.cast(SITE, { deviceToken: device, userId: `voter-${next}`, choice, point: NEARBY });
    }
    return result;
  };
  return { sites, reports, finder, cast };
}

describe("cleared votes (decision 20261010-1700)", () => {
  it("clear the site once 3 people say so, and it leaves the map but not its page", async () => {
    const { sites, finder, cast } = setup();
    await cast("cleaned", 2);
    expect(validateSite(sites.feature(SITE)).properties.status).toBe("open");
    const result = await cast("cleaned");
    expect(result?.votes).toEqual({ confirm: 0, reject: 0, cleaned: 3 });
    const props = validateSite(sites.feature(SITE)).properties;
    expect(props).toMatchObject({ status: "cleaned", cleaned_by: "votes", cleaned_at: "2026-10-10T06:03:00.000Z", cleanup_photo_url: null });
    expect(await finder.inBox(AROUND)).toEqual([]);
    expect((await finder.byId(SITE)).properties.status).toBe("cleaned");
  });

  it("count a later still-there vote against the cleared votes", async () => {
    const { sites, cast } = setup();
    await cast("cleaned", 2);
    await cast("confirm");
    await cast("cleaned");
    expect(validateSite(sites.feature(SITE)).properties.status).toBe("open");
    await cast("cleaned");
    expect(validateSite(sites.feature(SITE)).properties.status).toBe("cleaned");
  });

  it("need fresh votes after a new photo reopens the site", async () => {
    const { sites, finder, cast } = setup();
    await cast("cleaned", 3);
    const site = await sites.get(SITE);
    site?.merge(report({ id: "jdh_1r", device: "5b1d3c2e-7f4a-4e6b-8c9d-0a1b2c3d4e5f", lat: northOf(5), capturedAt: "2026-10-10T07:00:00Z" }));
    if (site !== null && site !== undefined) {
      sites.put(site);
    }
    expect((await finder.inBox(AROUND)).map((feature) => feature.properties.status)).toEqual(["reopened"]);
    await cast("confirm");
    expect(validateSite(sites.feature(SITE)).properties.status).toBe("reopened");
  });

  it("refuse a cleared vote on a site that is already cleared", async () => {
    const { cast } = setup();
    await cast("cleaned", 3);
    await expect(cast("cleaned")).rejects.toThrow(AlreadyCleanedError);
  });

  it("keep a vote-cleared verified site in the scores as cleared", async () => {
    const { sites, cast } = setup();
    await cast("confirm", 9);
    await cast("cleaned", 3);
    const props = validateSite(sites.feature(SITE)).properties;
    expect(props).toMatchObject({ verification: "verified", status: "cleaned", verified_count: 1 });
    const stored = await sites.get(SITE);
    const item = stored === null ? {} : new SiteItemMapper(new NgeohashCells(), new RecordingLogger(), RULES).toItem(stored);
    const area = new SiteItemParser(RULES.ttlDays).parse(item);
    expect(area.everCleared()).toBe(true);
    expect(new AreaSites([area]).counts()).toMatchObject({ sites: 1, cleaned_sites: 1, open_sites: 0, verified_reports: 1 });
  });
});

describe("the no-vote valve (decision 20261010-1530)", () => {
  it("takes a rejected site off the map at once, on the vote that tips it", async () => {
    const { finder, reports, cast } = setup();
    await cast("reject", 3);
    expect(await finder.inBox(AROUND)).toHaveLength(1);
    const result = await cast("reject");
    expect(result?.verification).toBe("rejected");
    expect(await finder.inBox(AROUND)).toEqual([]);
    expect(reports.statuses.get("rpt_jdh_1")).toBe("rejected");
  });
});
