import { describe, expect, it } from "vitest";
import { validateSite } from "../../src/contracts/index.gen.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import {
  AlreadyCleanedError,
  CleanupPendingError,
  InvalidTransitionError,
  OwnSiteError,
  TooFarError,
} from "../../src/domain/sites/SiteErrors.js";
import { VoteTally } from "../../src/domain/sites/VoteTally.js";
import {
  BASE_LAT,
  BASE_LON,
  BASE_URL,
  DEVICE_A,
  DEVICE_B,
  DEVICE_C,
  evidence,
  northOf,
  report,
} from "./builders.js";

const CLEANED_AT = "2026-10-10T05:00:00Z";
const AFTER_PHOTO = `${BASE_URL}/media/cleanups/cln_x.jpg`;

function cleanedSite(): Site {
  const site = Site.found(report());
  site.startCleanup("cln_x");
  site.acceptCleanup("cln_x", AFTER_PHOTO, CLEANED_AT);
  return site;
}

function tally(...choices: ("confirm" | "reject")[]): VoteTally {
  return VoteTally.of(
    choices.map((choice, index) => ({ siteId: "s", deviceToken: `d${index}`, choice, weight: 1, votedAt: CLEANED_AT })),
  );
}

describe("Site.found", () => {
  it("takes its id, place and evidence from the founding report", () => {
    const site = Site.found(report());
    const { properties, geometry } = validateSite(site.toFeature());
    expect(geometry.coordinates).toEqual([BASE_LON, BASE_LAT]);
    expect(properties).toMatchObject({
      site_id: "site_jdh_1",
      status: "open",
      verification: "verified",
      report_count: 1,
      verified_count: 1,
      corroborations: 0,
      photo_urls: [`${BASE_URL}/media/reports/rpt_jdh_1.jpg`],
      brands: [{ brand: "Sample Namkeen", source_url: "https://example.org/brand-map/sample-namkeen" }],
      first_reported_at: "2026-10-10T02:14:05Z",
      pilot: true,
    });
    expect(properties.location.ward?.id).toBe("jodhpur-south-mc-w37");
    expect(JSON.stringify(site.toFeature())).not.toContain(DEVICE_A);
  });

  it("starts a community check for a report the models could not settle", () => {
    const site = Site.found(report({ decision: "community_check" }));
    expect(site.verification).toBe("community_check");
    expect(site.toFeature().properties.verified_count).toBe(0);
  });
});

describe("Site.merge", () => {
  it("accepts the same type within 40 m only", () => {
    const site = Site.found(report());
    expect(site.accepts(report({ id: "jdh_2", lat: northOf(39) }))).toBe(true);
    expect(site.accepts(report({ id: "jdh_2", lat: northOf(41) }))).toBe(false);
    expect(site.accepts(report({ id: "jdh_2", reportType: "no_bin", context: "no_pickup" }))).toBe(false);
  });

  it("counts reports, auto-verified reports, photos (newest first, at most 6) and time span", () => {
    const site = Site.found(report({ decision: "community_check" }));
    for (let n = 2; n <= 8; n += 1) {
      site.merge(report({ id: `jdh_${n}`, capturedAt: `2026-10-10T0${n}:00:00Z`, device: DEVICE_B }));
    }
    const properties = site.toFeature().properties;
    expect(properties.report_count).toBe(8);
    expect(properties.verified_count).toBe(7);
    expect(properties.photo_urls).toHaveLength(6);
    expect(properties.photo_urls[0]).toBe(`${BASE_URL}/media/reports/rpt_jdh_8.jpg`);
    expect([properties.first_reported_at, properties.last_reported_at]).toEqual(["2026-10-10T02:00:00Z", "2026-10-10T08:00:00Z"]);
    expect(properties.brands).toHaveLength(1);
  });

  it("is idempotent per report id", () => {
    const site = Site.found(report());
    site.merge(report());
    expect(site.toFeature().properties.report_count).toBe(1);
  });

  it("counts a Me too from another device as a corroboration, once per device", () => {
    const site = Site.found(report());
    site.merge(report({ id: "jdh_2", device: DEVICE_B, meToo: "site_jdh_1" }));
    site.merge(report({ id: "jdh_3", device: DEVICE_B, meToo: "site_jdh_1" }));
    site.merge(report({ id: "jdh_4", device: DEVICE_A, meToo: "site_jdh_1" }));
    site.merge(report({ id: "jdh_5", device: DEVICE_C }));
    expect(site.toFeature().properties.corroborations).toBe(1);
  });

  it("marks burning only from an auto-verified report", () => {
    const site = Site.found(report({ decision: "community_check", burning: true }));
    expect(site.toFeature().properties.burning).toBe(false);
    site.merge(report({ id: "jdh_2", burning: true }));
    expect(site.toFeature().properties.burning).toBe(true);
  });

  it("verifies a community-check site when an auto-verified report merges in", () => {
    const site = Site.found(report({ decision: "community_check" }));
    site.merge(report({ id: "jdh_2", device: DEVICE_B }));
    expect(site.verification).toBe("verified");
  });

  it("takes only an auto-verified report once cleaned, which reopens it", () => {
    const site = cleanedSite();
    expect(site.accepts(report({ id: "jdh_2", decision: "community_check" }))).toBe(false);
    expect(() => site.merge(report({ id: "jdh_2", decision: "community_check" }))).toThrow(InvalidTransitionError);
    site.merge(report({ id: "jdh_3" }));
    expect(site.toFeature().properties).toMatchObject({
      status: "reopened",
      cleanup_status: "none",
      cleaned_at: CLEANED_AT,
      cleanup_photo_url: AFTER_PHOTO,
    });
  });

  it("never takes reports into a rejected site", () => {
    const site = Site.found(report({ decision: "community_check" }));
    site.recordVotes(tally("reject", "reject", "reject"));
    expect(site.isListed()).toBe(false);
    expect(site.accepts(report({ id: "jdh_2" }))).toBe(false);
  });
});

describe("Site votes", () => {
  it("refuses the reporter before checking distance, then voters beyond 1 km", () => {
    const site = Site.found(report());
    const far = new GeoPoint(BASE_LAT + 0.02, BASE_LON);
    expect(() => site.admitVoter(DEVICE_A, far)).toThrow(OwnSiteError);
    expect(() => site.admitVoter(DEVICE_B, far)).toThrow(TooFarError);
    expect(() => site.admitVoter(DEVICE_B, new GeoPoint(northOf(990), BASE_LON))).not.toThrow();
  });

  it("settles only during the community check and always counts corroborations", () => {
    const site = Site.found(report({ decision: "community_check" }));
    site.recordVotes(tally("confirm", "confirm", "confirm"));
    expect(site.voteResult()).toEqual({ site_id: "site_jdh_1", votes: { confirm: 3, reject: 0 }, verification: "verified" });
    site.recordVotes(tally("reject", "reject", "reject", "reject"));
    expect(site.verification).toBe("verified");
    expect(site.toFeature().properties.corroborations).toBe(0);
  });
});

describe("Site cleanup", () => {
  it("goes checking, then accepted with the after-photo and time", () => {
    const site = cleanedSite();
    expect(site.toFeature().properties).toMatchObject({
      status: "cleaned",
      cleanup_status: "accepted",
      cleanup_photo_url: AFTER_PHOTO,
      cleaned_at: CLEANED_AT,
    });
    expect(() => site.startCleanup("cln_y")).toThrow(AlreadyCleanedError);
  });

  it("allows one after-photo at a time and repeats the same one quietly", () => {
    const site = Site.found(report());
    site.startCleanup("cln_x");
    expect(() => site.startCleanup("cln_x")).not.toThrow();
    expect(() => site.startCleanup("cln_y")).toThrow(CleanupPendingError);
    site.rejectCleanup("cln_x");
    expect(site.toFeature().properties).toMatchObject({ status: "open", cleanup_status: "rejected" });
    expect(() => site.startCleanup("cln_y")).not.toThrow();
  });

  it("refuses to settle a cleanup it is not waiting for", () => {
    const site = Site.found(report());
    expect(() => site.acceptCleanup("cln_x", AFTER_PHOTO, CLEANED_AT)).toThrow(InvalidTransitionError);
    site.startCleanup("cln_x");
    expect(() => site.rejectCleanup("cln_other")).toThrow(InvalidTransitionError);
  });
});

describe("MergeableReportFactory", () => {
  it("refuses a rejected report and a verification of another report", () => {
    const factory = new MergeableReportFactory(new PublicMedia(BASE_URL));
    const base = evidence();
    const rejected = { ...base, verification: { ...base.verification, decision: "rejected" as const } };
    expect(() => factory.create(rejected)).toThrow(InternalDataError);
    const other = { ...base, verification: { ...base.verification, report_id: "rpt_other" } };
    expect(() => factory.create(other)).toThrow(/does not belong/);
  });

  it("marks Jodhpur district sites as pilot and others not", () => {
    const base = evidence();
    const jaipur = { ...base.location, district: { id: "rajasthan-jaipur", name: "Jaipur" } };
    const factory = new MergeableReportFactory(new PublicMedia(BASE_URL));
    expect(factory.create(base).pilot).toBe(true);
    expect(factory.create({ ...base, location: jaipur }).pilot).toBe(false);
  });
});
