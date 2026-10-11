import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import type { Site } from "../../src/domain/sites/Site.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { BASE_URL, DEVICE_B, evidence, northOf, type PhotoEvidence } from "../sites/builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock } from "../sites/fakes.js";
import { RETRY, RULES, SCORES } from "../defaults.js";

const SCAN = "scn_jdh_6";

// A geohash index that has not caught up with the table yet.
class LaggingIndexSites extends FakeSiteRepository {
  override async inCell(): Promise<Site[]> {
    return [];
  }
}

function setup(sites: FakeSiteRepository) {
  const embeddings = new FakeEmbeddings();
  // The neighbour's photo and frame b show one pile; frame a shows another.
  embeddings.add("embeddings/rpt_x.json", new EmbeddingVector([1, 0, 0]));
  embeddings.add("embeddings/rpt_b.json", new EmbeddingVector([1, 0, 0]));
  embeddings.add("embeddings/rpt_a.json", new EmbeddingVector([0, 1, 0]));
  return new SiteMerger({
    sites,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(embeddings, RULES.mergeMinCosine),
    reports: new FakeReportStatus(),
    scores: new FakeScoreSeeder(),
    clock: new FixedClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia(BASE_URL)),
    retry: new ConflictRetry(RETRY.saveAttempts),
    rules: RULES,
    minVerifiedReports: SCORES.minVerifiedReports,
  });
}

// A frame of the scan's first spot, `metres` north of the neighbour's photo.
function scanFrame(id: string, metres: number): PhotoEvidence {
  const base = evidence({ id, embeddingKey: `embeddings/rpt_${id}.json`, lat: northOf(metres) });
  return { ...base, upload: { ...base.upload, capture_mode: "scan", scan: { scan_id: SCAN, t_ms: metres * 1000 } }, scanSpot: 0 };
}

async function holdersOf(sites: FakeSiteRepository, reportId: string): Promise<string[]> {
  const all = await Promise.all((await sites.allIds()).map((siteId) => sites.get(siteId)));
  return all.flatMap((site) => (site?.holds(reportId) === true ? [site.siteId] : []));
}

describe("a redelivered scan frame", () => {
  it("stays in the neighbour site it joined, even after another frame of its spot founded the spot's site", async () => {
    const sites = new FakeSiteRepository();
    const merger = setup(sites);
    await merger.merge(evidence({ id: "x", device: DEVICE_B, embeddingKey: "embeddings/rpt_x.json" }));
    const first = await merger.merge(scanFrame("b", 2));
    expect(first).toMatchObject({ siteId: "site_x", outcome: "merged" });
    const spot = await merger.merge(scanFrame("a", 1));
    expect(spot.outcome).toBe("founded");
    expect(spot.siteId).not.toBe("site_x");

    const again = await merger.merge(scanFrame("b", 2));

    expect(again).toEqual({ siteId: "site_x", outcome: "unchanged", reportStatus: first.reportStatus });
    expect(await holdersOf(sites, "rpt_b")).toEqual(["site_x"]);
    expect(sites.feature("site_x").properties.report_count).toBe(2);
    expect(sites.feature(spot.siteId).properties.report_count).toBe(1);
  });

  it("stays in its spot's site when the geohash index does not show that site yet", async () => {
    const sites = new LaggingIndexSites();
    const merger = setup(sites);
    const founded = await merger.merge(scanFrame("a", 1));
    await merger.merge(scanFrame("b", 2));

    const again = await merger.merge(scanFrame("b", 2));

    expect(again).toMatchObject({ siteId: founded.siteId, outcome: "unchanged" });
    expect(await holdersOf(sites, "rpt_b")).toEqual([founded.siteId]);
    expect(sites.feature(founded.siteId).properties.report_count).toBe(2);
  });
});
