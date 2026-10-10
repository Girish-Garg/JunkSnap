import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { SiteItemMapper, type SiteItem } from "../../src/adapters/sites/SiteItemMapper.js";
import {
  validateSite,
  validateWardScores,
  type LocationLookup,
  type ModerationResult,
  type ReportUpload,
  type VerificationResult,
} from "../../src/contracts/index.gen.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { SiteFeature } from "../../src/domain/sites/SiteTypes.js";
import { VoteTally } from "../../src/domain/sites/VoteTally.js";
import { ZeroScoreRows } from "../../src/domain/sites/ZeroScoreRows.js";
import { BASE_URL, DEVICE_A, fixture, siteFixture, userOf } from "./builders.js";
import { NOW, RecordingLogger } from "./fakes.js";

const SAMPLES = ["jdh-1", "jdh-2", "jdh-3", "jpr-1"];
const cells = new NgeohashCells();
const mapper = new SiteItemMapper(cells, new RecordingLogger());

function itemOf(feature: SiteFeature): SiteItem {
  const [lon, lat] = feature.geometry.coordinates;
  const { corroborations, votes } = feature.properties;
  return {
    ...feature.properties,
    lat,
    lon,
    geohash4: cells.cellOf(new GeoPoint(lat, lon)),
    report_ids: [`rpt_${feature.properties.site_id.slice(5)}`],
    merged_reports: [{ report_id: `rpt_${feature.properties.site_id.slice(5)}`, verified: true, insights: null }],
    reporter_devices: [DEVICE_A],
    reporter_users: [userOf(DEVICE_A)],
    me_too_count: corroborations - votes.confirm,
    embedding_key: null,
    pending_cleanup_id: null,
    version: 3,
  };
}

describe("site fixtures round-trip", () => {
  it.each(SAMPLES)("site.%s goes item -> Site -> Feature unchanged and valid", (sample) => {
    const feature = siteFixture(sample);
    const site = mapper.toSite(itemOf(feature));
    expect(validateSite(site.toFeature())).toEqual(feature);
  });

  it.each(SAMPLES)("site.%s goes Site -> item -> Site with the next version and its geohash4", (sample) => {
    const feature = siteFixture(sample);
    const item = mapper.toItem(mapper.toSite(itemOf(feature)));
    const [lon, lat] = feature.geometry.coordinates;
    expect(item).toMatchObject({ version: 4, lat, lon, geohash4: cells.cellOf(new GeoPoint(lat, lon)) });
    expect(item).toMatchObject({ reporter_devices: [DEVICE_A], reporter_users: [userOf(DEVICE_A)] });
    expect(mapper.toSite(item).toFeature()).toEqual(feature);
  });

  it("refuses a stored item that breaks the site contract or lacks its internals", () => {
    const item = itemOf(siteFixture("jdh-1"));
    expect(() => mapper.toSite({ ...item, status: "gone" })).toThrow(InternalDataError);
    expect(() => mapper.toSite({ ...item, cleaned_at: "yesterday" })).toThrow(InternalDataError);
    expect(() => mapper.toSite({ ...item, lat: undefined })).toThrow(InternalDataError);
    expect(() => mapper.toSite({ ...item, merged_reports: [{ report_id: "rpt_x" }] })).toThrow(InternalDataError);
  });

  it("keeps device tokens and user ids out of the Feature", () => {
    const text = JSON.stringify(mapper.toSite(itemOf(siteFixture("jdh-1"))).toFeature());
    expect(text).not.toContain(DEVICE_A);
    expect(text).not.toContain(userOf(DEVICE_A));
  });

  it("loads an older item without insights or the newer internals", () => {
    const feature = siteFixture("jpr-1");
    const { insights: _dropped, ...older } = feature.properties;
    expect(_dropped).toBeDefined();
    const [lon, lat] = feature.geometry.coordinates;
    const site = mapper.toSite({ ...older, lat, lon, report_ids: ["rpt_jpr_1"] });
    expect(site.version).toBe(0);
    expect(site.reportIds).toEqual(["rpt_jpr_1"]);
    expect(validateSite(site.toFeature()).properties.insights).toBeUndefined();
  });
});

describe("merging the jpr-1 report fixtures", () => {
  it("rebuilds site.jpr-1 after one confirm vote", () => {
    const fixtureBin = siteFixture("jpr-1").properties.insights;
    const factory = new MergeableReportFactory(new PublicMedia(BASE_URL));
    const site = Site.found(
      factory.create({
        upload: fixture<ReportUpload>("report_upload.jpr-1.json"),
        moderation: fixture<ModerationResult>("moderation_result.jpr-1.json"),
        verification: fixture<VerificationResult>("verification_result.jpr-1.json"),
        location: fixture<LocationLookup>("location_lookup.jpr-1.json"),
        near: [],
        bin: { nearest_bin: fixtureBin?.nearest_bin ?? null, no_bin_within_3km: fixtureBin?.no_bin_within_3km ?? null },
        brands: [],
      }),
    );
    const vote = { siteId: "site_jpr_1", deviceToken: "d", userId: null, choice: "confirm" as const, weight: 1, votedAt: NOW };
    site.recordVotes(VoteTally.of([vote]));
    const expected = siteFixture("jpr-1");
    const built = validateSite(site.toFeature());
    expect(built.properties).toEqual(expected.properties);
    expect(site.point.distanceTo(new GeoPoint(26.853, 75.8156))).toBeLessThan(5);
    expect(site.embeddingKey).toBe("embeddings/rpt_jpr_1.json");
  });
});

describe("zero scores rows", () => {
  it.each(SAMPLES)("every area of site.%s gets a valid ward_scores row", (sample) => {
    const feature = siteFixture(sample);
    const rows = new ZeroScoreRows(feature).rows(NOW);
    const { ward, assembly_seat } = feature.properties.location;
    expect(rows).toHaveLength(2 + (ward === null ? 0 : 1) + (assembly_seat === null ? 0 : 1));
    for (const row of rows) {
      expect(validateWardScores(row).counts.sites).toBe(0);
      expect(row.pilot).toBe(feature.properties.pilot);
    }
  });

  it.each(SAMPLES)("site.%s places its rows within its district and local body", (sample) => {
    const { district, local_body } = siteFixture(sample).properties.location;
    const expected = local_body === null ? [district.id] : [district.id, local_body.id];
    expect(new ZeroScoreRows(siteFixture(sample)).within()).toEqual(expected);
  });
});
