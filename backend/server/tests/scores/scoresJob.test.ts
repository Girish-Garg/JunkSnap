import { describe, expect, it } from "vitest";
import type { AreaFactSheet } from "../../src/domain/AreaFactSheet.js";
import type { AreaScoresRow } from "../../src/domain/AreaInsights.js";
import type { AreaKey, AreaRef } from "../../src/domain/AreaKey.js";
import type { AreaSite } from "../../src/domain/AreaSite.js";
import { runScores } from "../../src/handlers/scores.js";
import type { AreaFacts } from "../../src/ports/AreaFacts.js";
import type { AreaReportReader } from "../../src/ports/AreaReportReader.js";
import type { AreaSiteReader } from "../../src/ports/AreaSiteReader.js";
import type { ScoreRepository } from "../../src/ports/ScoreRepository.js";
import { AreaGrouper } from "../../src/services/AreaGrouper.js";
import { ScoreCalculator } from "../../src/services/ScoreCalculator.js";
import { ScoresJob } from "../../src/services/ScoresJob.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { LogSink } from "../LogSink.js";
import { NO_FACTS, NOW, site, WARD } from "./siteBuilder.js";

const ASSEMBLY: AreaRef = { kind: "assembly", id: "s20-ac-127", name: "Sardarpura" };
const LOKSABHA: AreaRef = { kind: "loksabha", id: "s20-pc-16", name: "Jodhpur" };
const DISTRICT: AreaRef = { kind: "district", id: "rajasthan-jodhpur", name: "Jodhpur" };
const OTHER_WARD: AreaRef = { kind: "ward", id: "jodhpur-south-mc-w38", name: "Ward 38" };

class FakeSites implements AreaSiteReader {
  constructor(private readonly sites: AreaSite[]) {}

  async readAll(): Promise<AreaSite[]> {
    return this.sites;
  }
}

class FakeReports implements AreaReportReader {
  readonly asked: string[] = [];

  async verifiedReportTimes(siteId: string): Promise<number[]> {
    this.asked.push(siteId);
    return [Date.parse("2026-10-10T02:30:00Z")];
  }
}

class FakeFacts implements AreaFacts {
  readonly asked: string[] = [];

  async factsFor(area: AreaKey): Promise<AreaFactSheet> {
    this.asked.push(area.toString());
    return area.kind === "ward" ? { ...NO_FACTS, areaKm2: 1.5 } : NO_FACTS;
  }
}

class InMemoryScores implements ScoreRepository {
  readonly rows = new Map<string, AreaScoresRow>();

  async save(row: AreaScoresRow): Promise<void> {
    this.rows.set(`${row.area.kind}:${row.area.id}`, row);
  }

  async find(area: AreaKey): Promise<AreaScoresRow | null> {
    return this.rows.get(area.toString()) ?? null;
  }
}

function setup(sites: AreaSite[]) {
  const ports = { sites: new FakeSites(sites), reports: new FakeReports(), facts: new FakeFacts(), scores: new InMemoryScores() };
  return { ...ports, job: new ScoresJob(ports, ScoreCalculator.standard(), new AreaGrouper()) };
}

const everyArea = [WARD, ASSEMBLY, LOKSABHA, DISTRICT];

describe("ScoresJob", () => {
  it("scores every ward, assembly seat, Lok Sabha seat and district that holds a site", async () => {
    const { job, scores, facts } = setup([
      site({ siteId: "site_a", areas: everyArea, verifiedCount: 6 }),
      site({ siteId: "site_b", areas: [ASSEMBLY, LOKSABHA, DISTRICT], verifiedCount: 5 }),
    ]);
    expect(await job.run(NOW)).toEqual({ sites: 2, areas: 4 });
    expect([...scores.rows.keys()].sort()).toEqual(
      ["assembly:s20-ac-127", "district:rajasthan-jodhpur", "loksabha:s20-pc-16", "ward:jodhpur-south-mc-w37"],
    );
    expect(scores.rows.get("ward:jodhpur-south-mc-w37")?.counts.verified_reports).toBe(6);
    expect(scores.rows.get("assembly:s20-ac-127")?.counts.verified_reports).toBe(11);
    expect(facts.asked).toHaveLength(4);
  });

  it("gives an area whose sites were all rejected a zero-count, withheld row", async () => {
    const { job, scores } = setup([site({ areas: [OTHER_WARD], verification: "rejected", verifiedCount: 0 })]);
    await job.run(NOW);
    const row = scores.rows.get("ward:jodhpur-south-mc-w38");
    expect(row?.counts).toEqual({ verified_reports: 0, no_bin_reports: 0, sites: 0, open_sites: 0, cleaned_sites: 0, reopened_sites: 0 });
    expect(row?.scores.city).toEqual({ value: null, reason: "too_few_reports" });
    expect(row?.data_window).toEqual({ from: "2026-10-20T00:00:00Z", to: "2026-10-20T00:00:00Z" });
  });

  it("reads report times once per verified site with verified reports", async () => {
    const { job, reports, scores } = setup([
      site({ siteId: "site_v", areas: everyArea, verifiedCount: 2 }),
      site({ siteId: "site_c", verification: "community_check", verifiedCount: 0 }),
      site({ siteId: "site_z", verifiedCount: 0 }),
    ]);
    await job.run(NOW);
    expect(reports.asked).toEqual(["site_v"]);
    expect(scores.rows.get("ward:jodhpur-south-mc-w37")?.insights?.hour_of_day.reports).toBe(1);
  });

  it("overwrites each area's row on the next run", async () => {
    const { job, scores } = setup([site({ verifiedCount: 3 })]);
    await job.run(new Date("2026-10-19T00:00:00Z"));
    await job.run(NOW);
    expect(scores.rows.size).toBe(1);
    expect(scores.rows.get("ward:jodhpur-south-mc-w37")?.computed_at).toBe("2026-10-20T00:00:00Z");
  });
});

describe("runScores", () => {
  function entryContext(sink: LogSink) {
    const logger = new JsonLoggerFactory(sink).create({ service: "scores", stage: "dev" });
    return { settings: CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), logger, env: { JUNKSNAP_STAGE: "dev" } };
  }

  it("runs the job it is given and logs one summary line", async () => {
    const sink = new LogSink();
    const { job } = setup([site({ verifiedCount: 3 })]);
    await runScores(entryContext(sink), async () => job);
    const summary = { level: "INFO", message: "scores done", sites: 1, areas: 1 };
    expect(sink.records()).toEqual([expect.objectContaining(summary)]);
  });

  it("refuses to start without the table names", async () => {
    await expect(runScores(entryContext(new LogSink()))).rejects.toThrow(/SITES_TABLE/);
  });
});
