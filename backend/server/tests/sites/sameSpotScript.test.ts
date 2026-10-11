import { describe, expect, it } from "vitest";
import { APPLY_NEEDS_BASE_URL, SameSpotArgs } from "../../scripts/sameSpot/SameSpotArgs.js";
import { SameSpotGrouper, type SameSpotGroup } from "../../scripts/sameSpot/SameSpotGrouper.js";
import { SameSpotLines } from "../../scripts/sameSpot/SameSpotLines.js";
import { SameSpotScan } from "../../scripts/sameSpot/SameSpotScan.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { SiteProperties } from "../../src/domain/sites/SiteTypes.js";
import { clearByPhotos, northOf, report, type EvidenceOptions } from "./builders.js";
import { FakeSiteRepository, NOW } from "./fakes.js";
import { RULES } from "../defaults.js";

// The one-off listing of duplicates the old merge rule left (decision 20261011-1610-hem-same-spot-merge).
const AT = new Date(NOW);

interface Spot {
  // Metres north of BASE; a `report.lat` places it exactly instead.
  readonly north?: number;
  // The October day of its one photo.
  readonly day: string;
  readonly change?: Partial<SiteProperties>;
  readonly report?: EvidenceOptions;
}

// A stored site founded by one photo, with the properties a test changes.
function stored(sites: FakeSiteRepository, id: string, spot: Spot): void {
  const options = { id, device: `device-${id}`, lat: northOf(spot.north ?? 0), capturedAt: `2026-10-${spot.day}T05:00:00Z`, ...spot.report };
  const { feature, internals } = Site.found(report(options), RULES).snapshot();
  sites.putFeature({ ...feature, properties: { ...feature.properties, ...spot.change } }, internals);
}

async function scan(sites: FakeSiteRepository) {
  return new SameSpotScan(sites, new SameSpotGrouper(RULES.siteSameSpotM, AT)).run();
}

const shape = (groups: readonly SameSpotGroup[]) =>
  groups.map((group) => ({ keep: group.keep.siteId, absorb: group.absorb.map((entry) => [entry.site.siteId, entry.distanceM]) }));

describe("mergeSameSpotSites grouping", () => {
  it("finds the field case: two waste-dump sites 0.8 m apart, kept in the older", async () => {
    const sites = new FakeSiteRepository();
    stored(sites, "first", { day: "09" });
    stored(sites, "second", { north: 0.8, day: "10" });
    const findings = await scan(sites);
    expect(findings).toMatchObject({ read: 2, open: 2 });
    expect(shape(findings.groups)).toEqual([{ keep: "site_first", absorb: [["site_second", 0.8]] }]);
  });

  it("groups every site within 20 m of the oldest and leaves one 25 m off alone", async () => {
    const sites = new FakeSiteRepository();
    stored(sites, "newest", { north: 12, day: "10" });
    stored(sites, "oldest", { day: "07" });
    stored(sites, "middle", { north: -5, day: "08" });
    stored(sites, "apart", { north: -25, day: "09" });
    expect(shape((await scan(sites)).groups)).toEqual([{ keep: "site_oldest", absorb: [["site_middle", 5], ["site_newest", 12]] }]);
  });

  it("never chains neighbours: a site 30 m from the kept one stays, though 15 m from an absorbed one", async () => {
    const sites = new FakeSiteRepository();
    stored(sites, "a", { day: "07" });
    stored(sites, "b", { north: 15, day: "08" });
    stored(sites, "c", { north: 30, day: "09" });
    expect(shape((await scan(sites)).groups)).toEqual([{ keep: "site_a", absorb: [["site_b", 15]] }]);
  });

  it("joins the older of two kept sites on a tie, else the nearer one", async () => {
    // Latitudes exact in binary, so the two kept sites are exactly 2^-13 degrees (13.6 m) either side of the middle.
    const at = (steps: number) => ({ lat: 26.25 + steps * 2 ** -15 });
    const sites = new FakeSiteRepository();
    stored(sites, "south", { day: "07", report: at(-4) });
    stored(sites, "north", { day: "08", report: at(4) });
    stored(sites, "middle", { day: "09", report: at(0) });
    stored(sites, "nearnorth", { day: "10", report: at(1) });
    expect(shape((await scan(sites)).groups)).toEqual([
      { keep: "site_south", absorb: [["site_middle", 13.6]] },
      { keep: "site_north", absorb: [["site_nearnorth", 10.2]] },
    ]);
  });

  it("keeps different types apart, even 1 m apart", async () => {
    const sites = new FakeSiteRepository();
    stored(sites, "dump", { day: "09" });
    stored(sites, "bin", { north: 1, day: "10", report: { reportType: "overflowing_bin", context: "overflowing" } });
    expect((await scan(sites)).groups).toEqual([]);
  });

  it("leaves rejected, removed, cleaned and expired sites and no-bin zones out", async () => {
    const sites = new FakeSiteRepository();
    const zone = { reportType: "no_bin", context: "no_pickup" } as const;
    stored(sites, "open", { day: "09" });
    stored(sites, "rejected", { north: 1, day: "01", change: { verification: "rejected" } });
    stored(sites, "removed", { north: 1, day: "02", change: { status: "removed", removed_reason: "withdrawn", removed_at: NOW } });
    stored(sites, "expired", { north: 1, day: "03", change: { last_reported_at: "2026-01-01T00:00:00Z", expires_at: "2026-04-01T00:00:00Z" } });
    stored(sites, "zone", { north: 1, day: "04", report: zone });
    stored(sites, "zone2", { north: 2, day: "05", report: zone });
    const cleaned = Site.found(report({ id: "cleaned", device: "device-cleaned", lat: northOf(1), capturedAt: "2026-10-06T05:00:00Z" }), RULES);
    clearByPhotos(cleaned, NOW);
    sites.put(cleaned);
    expect(await scan(sites)).toMatchObject({ read: 7, open: 1, groups: [] });
  });

  it("only reads: no site is saved or changed", async () => {
    const sites = new FakeSiteRepository();
    stored(sites, "first", { day: "09" });
    stored(sites, "second", { north: 1, day: "10" });
    const before = sites.feature("site_second");
    await scan(sites);
    expect(sites.saves).toBe(0);
    expect(sites.feature("site_second")).toEqual(before);
  });
});

describe("mergeSameSpotSites output and arguments", () => {
  it("lists each group with site ids, report counts, backers and distances", async () => {
    const sites = new FakeSiteRepository();
    const backers = { count: 2, needed: 10, photo_people: 2, vote_people: 0 } as const;
    stored(sites, "first", { day: "09", change: { report_count: 2, backers } });
    stored(sites, "second", { north: 0.8, day: "10" });
    const lines = new SameSpotLines("dev", RULES.siteSameSpotM).lines(await scan(sites));
    expect(lines).toEqual([
      "dev: 2 sites read, 2 open photo sites, SITE_SAME_SPOT_M 20 m",
      "group 1 waste_dump: keep site_first (2 reports, 2 of 10 backers, unverified, first 2026-10-09T05:00:00Z)",
      "  absorb site_second (1 report, 1 of 10 backers, unverified, first 2026-10-10T05:00:00Z) at 0.8 m",
      "found: 1 groups, 1 sites to merge into the oldest site of their group",
    ]);
  });

  it("reads one stage's own tables and refuses anything else", () => {
    const tables = { sites: "junksnap-dev-sites", reports: "junksnap-dev-reports", votes: "junksnap-dev-votes", notes: "junksnap-dev-notes" };
    expect(new SameSpotArgs({}).parse(["dev"])).toEqual({ stage: "dev", tables, apply: null });
    expect(() => new SameSpotArgs({}).parse([])).toThrow(/usage/);
    expect(() => new SameSpotArgs({}).parse(["prod"])).toThrow(/usage/);
    expect(() => new SameSpotArgs({}).parse(["dev", "demo"])).toThrow(/usage/);
    expect(() => new SameSpotArgs({}).parse(["--apply"])).toThrow(/usage/);
  });

  it("takes --apply only with an https PUBLIC_BASE_URL", () => {
    const apply = new SameSpotArgs({ PUBLIC_BASE_URL: "https://d111111abcdef8.cloudfront.net/" }).parse(["dev", "--apply"]).apply;
    expect(apply).toEqual({ publicBaseUrl: "https://d111111abcdef8.cloudfront.net" });
    expect(() => new SameSpotArgs({}).parse(["dev", "--apply"])).toThrow(APPLY_NEEDS_BASE_URL);
    expect(() => new SameSpotArgs({ PUBLIC_BASE_URL: "http://example.com" }).parse(["dev", "--apply"])).toThrow(APPLY_NEEDS_BASE_URL);
  });
});
