import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { InProcessMergeLock } from "../../src/adapters/sites/InProcessMergeLock.js";
import type { ReportUpload } from "../../src/contracts/index.gen.js";
import { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import type { MergeEvidence } from "../../src/domain/sites/MergeableReport.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { OwnSiteError } from "../../src/domain/sites/SiteErrors.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { BASE_LAT, BASE_LON, BASE_URL, DEVICE_B, DEVICE_C, evidence, northOf, userOf } from "./builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock } from "./fakes.js";
import { RETRY, RULES, SCORES } from "../defaults.js";

// Decision 20261011-0400: a long-range pin can be dropped anywhere within 500 m, so it joins a site only on a
// matching photo. Without both embeddings, or with an unrelated photo, it founds its own site.
const PILE = [1, 0, 0];
const SAME_PILE = [0.95, Math.sqrt(1 - 0.95 ** 2), 0];
const OTHER_PILE = [0.2, 1, 0];

interface Shot {
  readonly id: string;
  readonly device: string;
  // Where the reporter stood, in metres north of BASE; the waste is marked at `targetNorth` (null: right here).
  readonly standNorth: number;
  readonly targetNorth: number | null;
  readonly vector?: readonly number[];
}

function setup() {
  const sites = new FakeSiteRepository();
  const embeddings = new FakeEmbeddings();
  const merger = new SiteMerger({
    sites,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(embeddings, RULES),
    lock: new InProcessMergeLock(),
    reports: new FakeReportStatus(),
    scores: new FakeScoreSeeder(),
    clock: new FixedClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia(BASE_URL)),
    retry: new ConflictRetry(RETRY.saveAttempts),
    rules: RULES,
    minVerifiedReports: SCORES.minVerifiedReports,
  });
  const shot = (s: Shot): MergeEvidence => {
    const key = s.vector === undefined ? null : `embeddings/rpt_${s.id}.json`;
    if (key !== null && s.vector !== undefined) embeddings.add(key, new EmbeddingVector(s.vector));
    const base = evidence({ id: s.id, device: s.device, lat: northOf(s.standNorth), embeddingKey: key });
    const target = s.targetNorth === null ? {} : { target: { lat: northOf(s.targetNorth), lon: BASE_LON } };
    const upload: ReportUpload = { ...base.upload, ...target };
    return { ...base, upload };
  };
  return { sites, merger, shot };
}

describe("long-range merge needs a matching photo", () => {
  it("merges two long-range photos of one pile, though the reporters stood far apart", async () => {
    const { merger, shot } = setup();
    const first = await merger.merge(shot({ id: "far_1", device: DEVICE_B, standNorth: 150, targetNorth: 0, vector: PILE }));
    const second = await merger.merge(shot({ id: "far_2", device: DEVICE_C, standNorth: -200, targetNorth: 15, vector: SAME_PILE }));
    expect(second).toMatchObject({ siteId: first.siteId, outcome: "merged" });
  });

  it("founds its own site when the long-range report has no embedding", async () => {
    const { merger, shot } = setup();
    const first = await merger.merge(shot({ id: "far_1", device: DEVICE_B, standNorth: 150, targetNorth: 0, vector: PILE }));
    const second = await merger.merge(shot({ id: "far_2", device: DEVICE_C, standNorth: -200, targetNorth: 10 }));
    expect(second.outcome).toBe("founded");
    expect(second.siteId).not.toBe(first.siteId);
  });

  it("founds its own site when the site it lands on has no embedding", async () => {
    const { merger, shot } = setup();
    await merger.merge(shot({ id: "here_1", device: DEVICE_B, standNorth: 0, targetNorth: null }));
    const far = await merger.merge(shot({ id: "far_2", device: DEVICE_C, standNorth: 250, targetNorth: 5, vector: PILE }));
    expect(far.outcome).toBe("founded");
  });

  it("founds its own site for an unrelated photo dropped on an existing site", async () => {
    const { merger, shot } = setup();
    await merger.merge(shot({ id: "far_1", device: DEVICE_B, standNorth: 150, targetNorth: 0, vector: PILE }));
    const other = await merger.merge(shot({ id: "far_2", device: DEVICE_C, standNorth: -300, targetNorth: 0, vector: OTHER_PILE }));
    expect(other.outcome).toBe("founded");
  });

  it("still merges a plain report without an embedding, as before", async () => {
    const { merger, shot } = setup();
    const first = await merger.merge(shot({ id: "here_1", device: DEVICE_B, standNorth: 0, targetNorth: null, vector: PILE }));
    const second = await merger.merge(shot({ id: "here_2", device: DEVICE_C, standNorth: 10, targetNorth: null }));
    expect(second).toMatchObject({ siteId: first.siteId, outcome: "merged" });
  });
});

describe("long-range reports and the people rules", () => {
  it("counts one backer per person and keeps own_site for the reporter", async () => {
    const { sites, merger, shot } = setup();
    const first = await merger.merge(shot({ id: "far_1", device: DEVICE_B, standNorth: 150, targetNorth: 0, vector: PILE }));
    const again = await merger.merge(shot({ id: "far_2", device: DEVICE_B, standNorth: -250, targetNorth: 8, vector: SAME_PILE }));
    expect(again).toMatchObject({ siteId: first.siteId, outcome: "merged" });
    expect(sites.feature(first.siteId).properties.backers).toMatchObject({ count: 1, photo_people: 1 });
    const site = await sites.get(first.siteId);
    const voter = { deviceToken: DEVICE_B, userId: userOf(DEVICE_B) };
    expect(() => site?.admitVoter(voter, new GeoPoint(BASE_LAT, BASE_LON), "confirm", new FixedClock().now())).toThrow(OwnSiteError);
    await merger.merge(shot({ id: "far_3", device: DEVICE_C, standNorth: 200, targetNorth: 5, vector: SAME_PILE }));
    expect(sites.feature(first.siteId).properties.backers).toMatchObject({ count: 2, photo_people: 2 });
  });
});
