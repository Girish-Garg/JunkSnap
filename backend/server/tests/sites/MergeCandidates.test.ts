import { describe, expect, it } from "vitest";
import { MergeCandidates } from "../../src/domain/sites/MergeCandidates.js";
import { olderFirst } from "../../src/domain/sites/utils.js";
import type { MergeableReport } from "../../src/domain/sites/MergeableReport.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { SiteProperties } from "../../src/domain/sites/SiteTypes.js";
import { clearByPhotos, northOf, report, type EvidenceOptions } from "./builders.js";
import { NOW } from "./fakes.js";
import { RULES } from "../defaults.js";

// Decision 20261011-1610-hem-same-spot-merge: within SITE_SAME_SPOT_M (20 m) a same-type report always joins.
const SAME_SPOT_M = RULES.siteSameSpotM;
const HERE = report({ id: "here", device: "device-here" });

// A site founded by one photo `metres` north of HERE, with the stored properties a test changes.
function siteAt(id: string, metres: number, change: Partial<SiteProperties> = {}, options: EvidenceOptions = {}): Site {
  const founded = Site.found(report({ id, device: `device-${id}`, lat: northOf(metres), ...options }), RULES);
  const { feature, internals } = founded.snapshot();
  return Site.restore({ feature: { ...feature, properties: { ...feature.properties, ...change } }, internals }, RULES);
}

const candidates = (nearby: readonly Site[], incoming: MergeableReport = HERE) => new MergeCandidates(incoming, nearby, SAME_SPOT_M);
const ids = (sites: readonly Site[]) => sites.map((site) => site.siteId);

describe("MergeCandidates at the same spot", () => {
  it("defaults SITE_SAME_SPOT_M to 20 m, inside the 40 m merge radius", () => {
    expect([RULES.siteSameSpotM, RULES.siteMergeRadiusM]).toEqual([20, 40]);
  });

  it("offers the nearest same-type site within 20 m, whatever its photo looks like", () => {
    const sites = [siteAt("mid", 15), siteAt("far", 30), siteAt("near", 1)];
    expect(candidates(sites).sameSpot()?.siteId).toBe("site_near");
    expect(ids(candidates(sites).open())).toEqual(["site_near", "site_mid", "site_far"]);
  });

  it("takes the oldest of two sites at the same distance, then the lower id", () => {
    const newer = siteAt("newer", 1, {}, { capturedAt: "2026-10-10T03:00:00Z" });
    const older = siteAt("older", 1, {}, { capturedAt: "2026-10-09T03:00:00Z" });
    expect(candidates([newer, older]).sameSpot()?.siteId).toBe("site_older");
    expect([siteAt("b", 1), siteAt("a", 1)].sort(olderFirst).map((site) => site.siteId)).toEqual(["site_a", "site_b"]);
  });

  it("leaves a site 25 m away to the photo test", () => {
    const far = siteAt("far", 25);
    expect(candidates([far]).sameSpot()).toBeNull();
    expect(ids(candidates([far]).others())).toEqual(["site_far"]);
  });

  it("never offers a site of another type, even 1 m away", () => {
    const bin = siteAt("bin", 1, {}, { reportType: "overflowing_bin", context: "overflowing" });
    expect(candidates([bin]).open()).toEqual([]);
  });
});

describe("MergeCandidates keeps the sites nothing may join", () => {
  it.each([
    ["rejected", { verification: "rejected" }],
    ["removed", { status: "removed", removed_reason: "withdrawn", removed_at: NOW }],
    ["marked expired", { status: "expired" }],
    ["past its expiry", { last_reported_at: "2026-01-01T00:00:00Z", expires_at: "2026-04-01T00:00:00Z" }],
  ] as const)("leaves out a %s site 1 m away", (_case, change) => {
    const closed = siteAt("closed", 1, change);
    expect(candidates([closed]).sameSpot()).toBeNull();
    expect(candidates([closed]).open()).toEqual([]);
  });

  it("still offers a cleaned site, which the new photo reopens (contracts: Withdrawal and clearing)", () => {
    const cleaned = Site.found(report({ id: "cleaned", device: "device-cleaned", lat: northOf(1) }), RULES);
    clearByPhotos(cleaned, NOW);
    const later = report({ id: "later", device: "device-later", capturedAt: "2026-10-10T07:00:00Z" });
    expect(candidates([cleaned], later).sameSpot()?.siteId).toBe("site_cleaned");
  });
});

describe("MergeCandidates outside the same-spot rule", () => {
  it("keeps a long-range pin to the photo test (decision 20261011-0400)", () => {
    const site = siteAt("site", 1);
    const pin = candidates([site], { ...HERE, longRange: true });
    expect(pin.sameSpot()).toBeNull();
    expect(pin.atSameSpot(site)).toBe(false);
    expect(ids(pin.others())).toEqual(["site_site"]);
  });

  it("keeps no-bin zones on their nearest-zone rule (decision 20261010-1630)", () => {
    const zone = siteAt("zone", 1, {}, { reportType: "no_bin", context: "no_pickup" });
    const noBin = candidates([zone], report({ id: "nb", device: "device-nb", reportType: "no_bin", context: "no_pickup" }));
    expect(noBin.sameSpot()).toBeNull();
    expect(ids(noBin.open())).toEqual(["site_zone"]);
  });

  it("names the Me too site and the scan spot's site apart from the others", () => {
    const [chosen, spot, other] = [siteAt("chosen", 30), siteAt("spot", 10), siteAt("other", 5)];
    const meToo = candidates([chosen, spot, other], { ...HERE, meTooSiteId: "site_chosen", spotSiteId: "site_spot" });
    expect(meToo.meToo()?.siteId).toBe("site_chosen");
    expect(meToo.spotSite()?.siteId).toBe("site_spot");
    expect(ids(meToo.others())).toEqual(["site_other", "site_spot"]);
    expect(meToo.sameSpot()?.siteId).toBe("site_other");
  });
});
