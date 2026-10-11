import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { SiteProperties } from "../../src/domain/sites/SiteTypes.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { BASE_URL, evidence, northOf, report, type EvidenceOptions, type PhotoEvidence } from "./builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock, NOW } from "./fakes.js";
import { RETRY, RULES, SCORES } from "../defaults.js";

// Decision 20261011-1610-hem-same-spot-merge: same type within SITE_SAME_SPOT_M (20 m) always merges; up to
// SITE_MERGE_RADIUS_M (40 m) only when the photos look alike (cosine MERGE_MIN_COSINE, 0.88, or more).
const PILE = [1, 0, 0];
const SAME_PILE = [0.95, Math.sqrt(1 - 0.95 ** 2), 0];
// Another angle of one dump can land here: cosine 0.6, well under 0.88.
const OTHER_ANGLE = [0.6, 0.8, 0];

function setup() {
  const sites = new FakeSiteRepository();
  const embeddings = new FakeEmbeddings();
  const merger = new SiteMerger({
    sites,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(embeddings, RULES),
    reports: new FakeReportStatus(),
    scores: new FakeScoreSeeder(),
    clock: new FixedClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia(BASE_URL)),
    retry: new ConflictRetry(RETRY.saveAttempts),
    rules: RULES,
    minVerifiedReports: SCORES.minVerifiedReports,
  });
  // One person's photo `north` metres from BASE, with its own embedding.
  const photo = (id: string, north: number, vector: readonly number[], options: EvidenceOptions = {}): PhotoEvidence => {
    embeddings.add(`embeddings/rpt_${id}.json`, new EmbeddingVector(vector));
    return evidence({ id, device: `device-${id}`, user: `user-${id}`, lat: northOf(north), embeddingKey: `embeddings/rpt_${id}.json`, ...options });
  };
  return { sites, merger, photo };
}

describe("same type at the same spot", () => {
  it("merges the field case: a third photo 0.8 m from a 2 of 10 site, from another angle, makes it 3 of 10", async () => {
    const { sites, merger, photo } = setup();
    await merger.merge(photo("a", 0, PILE));
    await merger.merge(photo("b", 0.5, SAME_PILE));
    expect(sites.feature("site_a").properties.backers).toMatchObject({ count: 2, needed: 10 });

    const third = await merger.merge(photo("c", 0.8, OTHER_ANGLE));

    expect(third).toEqual({ siteId: "site_a", outcome: "merged", reportStatus: "unverified" });
    expect(sites.count()).toBe(1);
    expect(sites.feature("site_a").properties).toMatchObject({ report_count: 3, backers: { count: 3, photo_people: 3 } });
  });

  it("merges two photos 1 m apart that look nothing alike", async () => {
    const { merger, photo } = setup();
    await merger.merge(photo("a", 0, PILE));
    expect(await merger.merge(photo("b", 1, [0, 0, 1]))).toMatchObject({ siteId: "site_a", outcome: "merged" });
  });

  it("joins the nearest of several sites within 20 m, the oldest on a tie", async () => {
    const { sites, merger, photo } = setup();
    // Duplicates from before the rule, seeded directly: two at one point and a newer one 10 m on.
    const seed = (id: string, north: number, capturedAt: string) =>
      sites.put(Site.found(report({ id, device: `device-${id}`, lat: northOf(north), capturedAt }), RULES));
    seed("newer", 5, "2026-10-10T01:00:00Z");
    seed("older", 5, "2026-10-09T01:00:00Z");
    seed("newest", 15, "2026-10-10T05:00:00Z");
    expect((await merger.merge(photo("tie", 0, PILE))).siteId).toBe("site_older");
    expect((await merger.merge(photo("nearest", 14, PILE))).siteId).toBe("site_newest");
    expect(sites.count()).toBe(3);
  });
});

describe("same type beyond the same spot", () => {
  it("founds a new site 25 m away when the photos look different", async () => {
    const { sites, merger, photo } = setup();
    await merger.merge(photo("a", 0, PILE));
    expect(await merger.merge(photo("b", 25, OTHER_ANGLE))).toMatchObject({ siteId: "site_b", outcome: "founded" });
    expect(sites.count()).toBe(2);
  });

  it("merges 25 m away when the photos look alike", async () => {
    const { merger, photo } = setup();
    await merger.merge(photo("a", 0, PILE));
    expect(await merger.merge(photo("b", 25, SAME_PILE))).toMatchObject({ siteId: "site_a", outcome: "merged" });
  });
});

describe("what the same-spot rule never joins", () => {
  it("keeps a different type 1 m away apart, whatever the photos", async () => {
    const { merger, photo } = setup();
    await merger.merge(photo("dump", 0, PILE));
    const bin = photo("bin", 1, PILE, { reportType: "overflowing_bin", context: "overflowing" });
    expect(await merger.merge(bin)).toMatchObject({ siteId: "site_bin", outcome: "founded" });
  });

  it.each([
    ["rejected", { verification: "rejected" }],
    ["removed", { status: "removed", removed_reason: "withdrawn", removed_at: NOW }],
    ["expired", { status: "expired" }],
  ] as const)("founds a new site next to a site that is %s", async (_case, change: Partial<SiteProperties>) => {
    const { sites, merger, photo } = setup();
    await merger.merge(photo("a", 0, PILE));
    const stored = sites.feature("site_a");
    sites.putFeature({ ...stored, properties: { ...stored.properties, ...change } }, sites.internals("site_a"));
    expect(await merger.merge(photo("b", 1, SAME_PILE))).toMatchObject({ siteId: "site_b", outcome: "founded" });
    expect(sites.feature("site_a").properties.report_count).toBe(1);
  });
});

// A frame of one scan spot, `north` metres from BASE; frames of a spot share its site id (contracts v1.10).
function frame(photo: ReturnType<typeof setup>["photo"], id: string, north: number, vector: readonly number[]): PhotoEvidence {
  const base = photo(id, north, vector, { device: "rider", user: "user-rider" });
  return { ...base, upload: { ...base.upload, capture_mode: "scan", scan: { scan_id: "scn_jdh_9", t_ms: 1000 } }, scanSpot: 0 };
}

describe("scan frames and the same spot", () => {
  it("join an existing site within 20 m, even after another frame founded the spot's own site", async () => {
    const { merger, photo } = setup();
    await merger.merge(photo("x", 0, PILE));
    const spot = await merger.merge(frame(photo, "f1", 22, [0, 1, 0]));
    expect(spot.outcome).toBe("founded");

    expect(await merger.merge(frame(photo, "f2", 3, [0, 0, 1]))).toMatchObject({ siteId: "site_x", outcome: "merged" });
    expect(await merger.merge(frame(photo, "f3", 18, [0, 0, 1]))).toMatchObject({ siteId: spot.siteId, outcome: "merged" });
  });
});
