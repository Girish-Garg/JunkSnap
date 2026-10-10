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
  afterPhoto,
  BASE_LAT,
  BASE_LON,
  BASE_URL,
  clearByPhotos,
  DEVICE_A,
  DEVICE_B,
  DEVICE_C,
  DEVICE_D,
  evidence,
  NO_VOTES,
  northOf,
  report,
  userOf,
} from "./builders.js";

const CLEANED_AT = "2026-10-10T05:00:00.000Z";
const AT = new Date(CLEANED_AT);
const AFTER_PHOTO = `${BASE_URL}/media/cleanups/cln_cleaner-3.jpg`;

// Nine yes votes plus the founding photo make the ten backers that verify a site.
function verified(site: Site): Site {
  site.recordVotes(tally(...Array.from({ length: 9 }, () => "confirm" as const)));
  return site;
}

function cleanedSite(): Site {
  const site = Site.found(report());
  clearByPhotos(site, CLEANED_AT);
  return site;
}

function tally(...choices: ("confirm" | "reject")[]): VoteTally {
  return VoteTally.of(
    choices.map((choice, index) => ({
      siteId: "s",
      deviceToken: `d${index}`,
      userId: null,
      choice,
      votedAt: CLEANED_AT,
    })),
  );
}

describe("Site.found", () => {
  it("takes its id, place and evidence from the founding report", () => {
    const site = verified(Site.found(report()));
    const { properties, geometry } = validateSite(site.toFeature());
    expect(geometry.coordinates).toEqual([BASE_LON, BASE_LAT]);
    expect(properties).toMatchObject({
      site_id: "site_jdh_1",
      status: "open",
      verification: "verified",
      report_count: 1,
      verified_count: 1,
      corroborations: 9,
      photo_urls: [`${BASE_URL}/media/reports/rpt_jdh_1.jpg`],
      brands: [{ brand: "Sample Namkeen", source_url: "https://example.org/brand-map/sample-namkeen" }],
      first_reported_at: "2026-10-10T02:14:05Z",
      pilot: true,
    });
    expect(properties.location.assembly_seat?.id).toBe("s20-ac-128");
    expect(properties.insights).toMatchObject({
      reports: 1,
      composition: [{ material: "plastic", share_pct: 55, reports: 1 }, { material: "organic" }, { material: "paper" }],
      size_class: { value: "medium", reports: 1 },
      hazards: [],
      near: [],
    });
    const text = JSON.stringify(site.toFeature());
    expect(text).not.toContain(DEVICE_A);
    expect(text).not.toContain(userOf(DEVICE_A));
  });

  it("starts unverified, with no insights from unverified photos", () => {
    const site = Site.found(report({ decision: "community_check" }));
    expect(site.verification).toBe("unverified");
    expect(site.toFeature().properties).toMatchObject({
      verified_count: 0,
      insights: { reports: 0, composition: [], size_class: null, hazards: [], near: [] },
    });
  });
});

describe("Site.merge", () => {
  it("accepts the same type within 40 m only", () => {
    const site = Site.found(report());
    expect(site.accepts(report({ id: "jdh_2", lat: northOf(39) }))).toBe(true);
    expect(site.accepts(report({ id: "jdh_2", lat: northOf(41) }))).toBe(false);
    expect(site.accepts(report({ id: "jdh_2", reportType: "no_bin", context: "no_pickup" }))).toBe(false);
  });

  it("merges overflowing or broken bins like any other type: same type within 40 m", () => {
    const bin = { reportType: "overflowing_bin", context: "overflowing" } as const;
    const site = Site.found(report(bin));
    expect(site.accepts(report({ ...bin, id: "jdh_2", lat: northOf(39), context: "damaged" }))).toBe(true);
    expect(site.accepts(report({ ...bin, id: "jdh_2", lat: northOf(41) }))).toBe(false);
    expect(site.accepts(report({ id: "jdh_2" }))).toBe(false);
  });

  it("counts reports, photos (newest first, at most 6) and time span", () => {
    const site = Site.found(report({ decision: "community_check" }));
    for (let n = 2; n <= 8; n += 1) {
      site.merge(report({ id: `jdh_${n}`, capturedAt: `2026-10-10T0${n}:00:00Z`, device: DEVICE_B }));
    }
    const properties = site.toFeature().properties;
    expect(properties.report_count).toBe(8);
    expect(properties.verified_count).toBe(0);
    expect(properties.backers).toMatchObject({ count: 2, photo_people: 2 });
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
    site.merge(report({ id: "jdh_6", device: DEVICE_D, user: userOf(DEVICE_B), meToo: "site_jdh_1" }));
    expect(site.toFeature().properties.corroborations).toBe(1);
  });

  it("marks burning exactly when a verified site's reports list it as a hazard", () => {
    const site = Site.found(report({ burning: true }));
    expect(site.toFeature().properties).toMatchObject({ burning: false, insights: { hazards: [] } });
    verified(site);
    expect(site.toFeature().properties).toMatchObject({
      burning: true,
      insights: { reports: 1, hazards: [{ hazard: "burning", reports: 1 }] },
    });
  });

  it("counts a report merged into a verified site as verified", () => {
    const site = verified(Site.found(report()));
    site.merge(report({ id: "jdh_2", decision: "community_check", device: DEVICE_B }));
    expect(site.toFeature().properties).toMatchObject({ report_count: 2, verified_count: 2, insights: { reports: 2 } });
  });

  it("never verifies a site from a confident model alone", () => {
    const site = Site.found(report({ decision: "community_check" }));
    site.merge(report({ id: "jdh_2", device: DEVICE_B, decision: "auto_verified" }));
    expect(site.verification).toBe("unverified");
  });

  it("takes any passed photo once cleaned, which reopens it", () => {
    const site = cleanedSite();
    site.merge(report({ id: "jdh_3", decision: "community_check", device: DEVICE_B }));
    expect(site.toFeature().properties).toMatchObject({
      status: "reopened",
      cleanup_status: "none",
      cleaned_at: CLEANED_AT,
      cleanup_photo_url: AFTER_PHOTO,
    });
  });

  it("never takes reports into a rejected site", () => {
    const site = Site.found(report({ decision: "community_check" }));
    site.recordVotes(tally("reject", "reject", "reject", "reject"));
    expect(site.isListed()).toBe(false);
    expect(site.accepts(report({ id: "jdh_2" }))).toBe(false);
  });
});

describe("Site votes", () => {
  it("refuses the reporter before checking distance, then voters beyond 1 km", () => {
    const site = Site.found(report());
    const far = new GeoPoint(BASE_LAT + 0.02, BASE_LON);
    const voter = (deviceToken: string, userId: string | null) => ({ deviceToken, userId });
    expect(() => site.admitVoter(voter(DEVICE_A, null), far, "confirm", AT)).toThrow(OwnSiteError);
    expect(() => site.admitVoter(voter(DEVICE_B, userOf(DEVICE_A)), far, "confirm", AT)).toThrow(OwnSiteError);
    expect(() => site.admitVoter(voter(DEVICE_B, userOf(DEVICE_B)), far, "confirm", AT)).toThrow(TooFarError);
    expect(() => site.admitVoter(voter(DEVICE_B, null), new GeoPoint(northOf(990), BASE_LON), "confirm", AT)).not.toThrow();
  });

  it("counts every waiting report as verified once votes confirm the site, and merges their insights", () => {
    const site = Site.found(report({ decision: "community_check" }));
    site.merge(report({ id: "jdh_2", decision: "community_check", device: DEVICE_B, burning: true }));
    site.recordVotes(tally(...Array.from({ length: 8 }, () => "confirm" as const)));
    expect(site.toFeature().properties).toMatchObject({
      verification: "verified",
      verified_count: 2,
      burning: true,
      insights: { reports: 2 },
    });
    expect(site.toFeature().properties.insights?.composition[0]).toMatchObject({ material: "plastic", share_pct: 55, reports: 2 });
  });

  it("settles only while unverified and always counts the votes", () => {
    const site = verified(Site.found(report({ decision: "community_check" })));
    expect(site.voteResult()).toEqual({
      site_id: "site_jdh_1",
      votes: { confirm: 9, reject: 0, cleaned: 0 },
      backers: { count: 10, needed: 10, photo_people: 1, vote_people: 9 },
      verification: "verified",
    });
    site.recordVotes(tally("reject", "reject", "reject", "reject"));
    expect(site.verification).toBe("verified");
    expect(site.toFeature().properties.corroborations).toBe(0);
  });
});

describe("Site cleanup", () => {
  it("is cleaned by the third person's after-photo, with that photo and time", () => {
    const site = cleanedSite();
    expect(site.toFeature().properties).toMatchObject({
      status: "cleaned",
      cleanup_status: "accepted",
      cleanup_photo_url: AFTER_PHOTO,
      cleaned_at: CLEANED_AT,
    });
    expect(() => site.startCleanup("cln_y", AT)).toThrow(AlreadyCleanedError);
  });

  it("allows one after-photo at a time and repeats the same one quietly", () => {
    const site = Site.found(report());
    site.startCleanup("cln_x", AT);
    expect(() => site.startCleanup("cln_x", AT)).not.toThrow();
    expect(() => site.startCleanup("cln_y", AT)).toThrow(CleanupPendingError);
    site.rejectCleanup("cln_x");
    expect(site.toFeature().properties).toMatchObject({ status: "open", cleanup_status: "rejected" });
    expect(() => site.startCleanup("cln_y", AT)).not.toThrow();
  });

  it("refuses to settle a cleanup it is not waiting for", () => {
    const site = Site.found(report());
    expect(() => site.acceptCleanup(afterPhoto("cleaner-1", CLEANED_AT, "cln_x"), NO_VOTES)).toThrow(InvalidTransitionError);
    site.startCleanup("cln_x", AT);
    expect(() => site.rejectCleanup("cln_other")).toThrow(InvalidTransitionError);
  });
});

describe("MergeableReportFactory", () => {
  it("refuses a photo the models did not pass and a verification of another report", () => {
    const factory = new MergeableReportFactory(new PublicMedia(BASE_URL));
    const base = evidence();
    const rejected = { ...base, verification: { ...base.verification, decision: "rejected" as const } };
    expect(() => factory.create(rejected)).toThrow(InternalDataError);
    const unsafe = { ...base, moderation: { ...base.moderation, outcome: "rejected" as const } };
    expect(() => factory.create(unsafe)).toThrow(/did not pass/);
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
