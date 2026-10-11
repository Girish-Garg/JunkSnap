import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { validateWardScores, type WardScores } from "../../src/contracts/index.gen.js";
import { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import { VoteTally } from "../../src/domain/sites/VoteTally.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { BASE_URL, clearByPhotos, DEVICE_B, evidence, fixture, northOf, report } from "./builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock, NOW } from "./fakes.js";
import { RULES, SCORES } from "../defaults.js";

// A geohash index that has not caught up with the table yet.
class LaggingIndexSites extends FakeSiteRepository {
  override async inCell(): Promise<Site[]> {
    return [];
  }
}

function setup(sites = new FakeSiteRepository()) {
  const reports = new FakeReportStatus();
  const scores = new FakeScoreSeeder();
  const embeddings = new FakeEmbeddings();
  const merger = new SiteMerger({
    sites,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(embeddings, RULES.mergeMinCosine),
    reports,
    scores,
    clock: new FixedClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia(BASE_URL)),
    retry: new ConflictRetry(),
    rules: RULES,
    minVerifiedReports: SCORES.minVerifiedReports,
  });
  return { sites, reports, scores, embeddings, merger };
}

describe("SiteMerger founding", () => {
  it("founds a site named after the report and seeds a zero row per area", async () => {
    const { merger, sites, scores } = setup();
    const result = await merger.merge(evidence());
    expect(result).toEqual({ siteId: "site_jdh_1", outcome: "founded", reportStatus: "unverified" });
    expect(sites.feature("site_jdh_1").properties.report_count).toBe(1);
    expect([...scores.rows.keys()].sort()).toEqual([
      "assembly/s20-ac-128",
      "district/rajasthan-jodhpur",
      "loksabha/s20-pc-16",
    ]);
    const row = validateWardScores(scores.rows.get("assembly/s20-ac-128"));
    expect(row).toMatchObject({
      area: { kind: "assembly", id: "s20-ac-128", name: "Jodhpur" },
      counts: { verified_reports: 0, sites: 0 },
      scores: { city: { value: null, reason: "too_few_reports" } },
      diagnosis: [],
      pilot: true,
      data_window: { from: "2026-10-10T02:14:05Z", to: NOW },
    });
    expect(scores.within.get("assembly/s20-ac-128")).toEqual(["rajasthan-jodhpur", "jodhpur-mc"]);
  });

  it("never overwrites an existing scores row and skips a null ward or assembly seat", async () => {
    const { merger, scores } = setup();
    const existing = fixture<WardScores>("ward_scores.jpr-1.json");
    await scores.seedIfMissing({ ...existing, area: { kind: "loksabha", id: "s20-pc-16", name: "Jodhpur" } }, ["rajasthan-jodhpur"]);
    const base = evidence();
    const ward = { id: "jodhpur-mc-w37", name: "Ward 37" };
    await merger.merge({ ...base, location: { ...base.location, ward, assembly_seat: null } });
    expect([...scores.rows.keys()].sort()).toEqual(["district/rajasthan-jodhpur", "loksabha/s20-pc-16", "ward/jodhpur-mc-w37"]);
    expect(scores.rows.get("loksabha/s20-pc-16")?.counts.sites).toBe(1);
  });

  it("starts an unverified site even for a photo the models were sure about", async () => {
    const { merger, sites } = setup();
    const result = await merger.merge(evidence({ decision: "auto_verified" }));
    expect(result.reportStatus).toBe("unverified");
    expect(sites.feature("site_jdh_1").properties.backers).toEqual({ count: 1, needed: 10, photo_people: 1, vote_people: 0 });
  });
});

describe("SiteMerger merging", () => {
  it("merges the same type within 40 m and founds a new site otherwise", async () => {
    const { merger, sites } = setup();
    await merger.merge(evidence());
    expect((await merger.merge(evidence({ id: "jdh_2", lat: northOf(35) }))).outcome).toBe("merged");
    expect((await merger.merge(evidence({ id: "jdh_3", lat: northOf(-45) }))).siteId).toBe("site_jdh_3");
    const noBin = evidence({ id: "jdh_4", reportType: "no_bin", context: "no_pickup" });
    expect((await merger.merge(noBin)).siteId).toBe("site_jdh_4");
    expect(sites.feature("site_jdh_1").properties.report_count).toBe(2);
    expect(sites.count()).toBe(3);
  });

  it("is idempotent per report id", async () => {
    const { merger, sites } = setup();
    await merger.merge(evidence());
    await merger.merge(evidence({ id: "jdh_2" }));
    expect(await merger.merge(evidence())).toMatchObject({ siteId: "site_jdh_1", outcome: "unchanged" });
    expect(await merger.merge(evidence({ id: "jdh_2" }))).toMatchObject({ outcome: "unchanged" });
    expect(sites.feature("site_jdh_1").properties.report_count).toBe(2);
  });

  it("returns the founded site unchanged when a retry misses it in a lagging index", async () => {
    const { merger, sites } = setup(new LaggingIndexSites());
    await merger.merge(evidence());
    expect(await merger.merge(evidence())).toMatchObject({ siteId: "site_jdh_1", outcome: "unchanged" });
    expect(sites.feature("site_jdh_1").properties.report_count).toBe(1);
  });

  it("skips rejected sites", async () => {
    const { merger, sites } = setup();
    const rejected = Site.found(report({ decision: "community_check" }), RULES);
    const rejectVote = (n: number) => ({ siteId: "s", deviceToken: `d${n}`, userId: null, choice: "reject" as const, votedAt: NOW });
    rejected.recordVotes(VoteTally.of([1, 2, 3, 4].map(rejectVote)));
    sites.put(rejected);
    expect((await merger.merge(evidence({ id: "jdh_2" }))).siteId).toBe("site_jdh_2");
  });

  it("lets a passed photo into a cleaned site, which reopens it", async () => {
    const { merger, sites } = setup();
    const cleaned = Site.found(report(), RULES);
    clearByPhotos(cleaned, NOW);
    sites.put(cleaned);
    const later = evidence({ id: "jdh_3", decision: "community_check", capturedAt: "2026-10-10T07:00:00Z" });
    expect((await merger.merge(later)).siteId).toBe("site_jdh_1");
    expect(sites.feature("site_jdh_1").properties).toMatchObject({ status: "reopened", cleanup_status: "none" });
  });

  it("prefers the Me too site over a nearer one when both qualify", async () => {
    const { merger, sites } = setup();
    sites.put(Site.found(report({ id: "far", lat: northOf(30) }), RULES));
    sites.put(Site.found(report({ id: "near", lat: northOf(-2) }), RULES));
    expect((await merger.merge(evidence({ id: "a", meToo: "site_far", device: DEVICE_B }))).siteId).toBe("site_far");
    expect((await merger.merge(evidence({ id: "b" }))).siteId).toBe("site_near");
    expect(sites.feature("site_far").properties.corroborations).toBe(1);
  });

  it("retries after another writer saved the site first", async () => {
    const { merger, sites } = setup();
    await merger.merge(evidence());
    sites.failNextSaves(1);
    expect((await merger.merge(evidence({ id: "jdh_2" }))).outcome).toBe("merged");
    expect(sites.feature("site_jdh_1").properties.report_count).toBe(2);
  });
});

describe("SiteMerger embeddings", () => {
  async function withVectors(site: number[], incoming: number[]) {
    const context = setup();
    context.embeddings.add("embeddings/rpt_jdh_1.json", new EmbeddingVector(site));
    context.embeddings.add("embeddings/rpt_jdh_2.json", new EmbeddingVector(incoming));
    await context.merger.merge(evidence({ embeddingKey: "embeddings/rpt_jdh_1.json" }));
    const result = await context.merger.merge(evidence({ id: "jdh_2", embeddingKey: "embeddings/rpt_jdh_2.json" }));
    return { ...context, result };
  }

  it("merges when the cosine similarity reaches the threshold", async () => {
    const { result } = await withVectors([1, 0, 0], [0.9, 0.3, 0]);
    expect(result).toMatchObject({ siteId: "site_jdh_1", outcome: "merged" });
  });

  it("keeps two piles apart below the SigLIP threshold of 0.88", async () => {
    expect(RULES.mergeMinCosine).toBe(0.88);
    const { result } = await withVectors([1, 0, 0], [0.85, Math.sqrt(1 - 0.85 ** 2), 0]);
    expect(result).toMatchObject({ siteId: "site_jdh_2", outcome: "founded" });
  });

  it("never merges on vectors from different embedding models", async () => {
    const { result } = await withVectors([1, 0, 0], [1, 0]);
    expect(result).toMatchObject({ siteId: "site_jdh_2", outcome: "founded" });
  });

  it("founds a new site when the photos look different", async () => {
    const { result } = await withVectors([1, 0, 0], [0.2, 1, 0]);
    expect(result).toMatchObject({ siteId: "site_jdh_2", outcome: "founded" });
  });

  it("skips the comparison when either side has no embedding", async () => {
    const { merger, embeddings } = setup();
    await merger.merge(evidence());
    expect((await merger.merge(evidence({ id: "jdh_2", embeddingKey: "embeddings/rpt_jdh_2.json" }))).outcome).toBe(
      "merged",
    );
    expect(embeddings.reads).toBe(0);
  });
});

// The nth photo comes from its own person.
const person = (n: number) => ({ id: `jdh_${n}`, device: `device-${n}`, user: `user-${n}` });

async function photos(merger: SiteMerger, from: number, to: number) {
  let last;
  for (let n = from; n <= to; n += 1) {
    last = await merger.merge(evidence(person(n)));
  }
  return last;
}

describe("SiteMerger report status", () => {
  it("moves every merged report to verified when the tenth person's photo verifies the site", async () => {
    const { merger, reports } = setup();
    expect((await photos(merger, 1, 9))?.reportStatus).toBe("unverified");
    expect(await photos(merger, 10, 10)).toMatchObject({ siteId: "site_jdh_1", reportStatus: "verified" });
    expect([...reports.statuses.values()]).toEqual(Array.from({ length: 10 }, () => "verified"));
  });

  it("gives every report its unverified site's status on every pass", async () => {
    const { merger, reports } = setup();
    await merger.merge(evidence({ decision: "auto_verified" }));
    await merger.merge(evidence({ id: "jdh_2", decision: "community_check", device: DEVICE_B }));
    expect(Object.fromEntries(reports.statuses)).toEqual({ rpt_jdh_1: "unverified", rpt_jdh_2: "unverified" });
    await merger.merge(evidence({ id: "jdh_2", decision: "community_check", device: DEVICE_B }));
    expect(reports.calls).toBe(3);
  });

  it("repairs the statuses when a redelivered message follows a failed status write", async () => {
    const { merger, reports, sites } = setup();
    await photos(merger, 1, 9);
    reports.failNext();
    await expect(photos(merger, 10, 10)).rejects.toThrow(/unreachable/);
    expect(sites.feature("site_jdh_1").properties.verification).toBe("verified");
    expect(reports.statuses.get("rpt_jdh_10")).toBeUndefined();
    expect(await photos(merger, 10, 10)).toMatchObject({ outcome: "unchanged", reportStatus: "verified" });
    expect(reports.statuses.get("rpt_jdh_1")).toBe("verified");
    expect(reports.statuses.get("rpt_jdh_10")).toBe("verified");
  });
});
