import { describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { validateWardScores, type WardScores } from "../../src/contracts/index.gen.js";
import type { AreaFactSheet } from "../../src/domain/AreaFactSheet.js";
import type { ComputedAreaScores } from "../../src/domain/AreaInsights.js";
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
import { LogSink } from "../LogSink.js";
import { NO_FACTS, NOW, site, WARD } from "./siteBuilder.js";

const ASSEMBLY: AreaRef = { kind: "assembly", id: "s20-ac-127", name: "Sardarpura" };
const LOKSABHA: AreaRef = { kind: "loksabha", id: "s20-pc-16", name: "Jodhpur" };
const DISTRICT: AreaRef = { kind: "district", id: "rajasthan-jodhpur", name: "Jodhpur" };
const OTHER_WARD: AreaRef = { kind: "ward", id: "jodhpur-mc-w38", name: "Ward 38" };

class FakeSites implements AreaSiteReader {
  readonly #sites: AreaSite[];

  constructor(sites: AreaSite[]) {
    this.#sites = sites;
  }

  async readAll(): Promise<AreaSite[]> {
    return this.#sites;
  }
}

class FakeReports implements AreaReportReader {
  readonly asked: string[] = [];
  failFor = "";

  async verifiedReportTimes(siteId: string): Promise<number[]> {
    this.asked.push(siteId);
    if (siteId === this.failFor) {
      throw new Error("reports table unreachable");
    }
    return [Date.parse("2026-10-10T02:30:00Z")];
  }
}

class FakeFacts implements AreaFacts {
  readonly asked: string[] = [];

  async factsFor(area: AreaKey, localBodyIds: readonly string[]): Promise<AreaFactSheet> {
    this.asked.push(`${area.toString()} ${localBodyIds.join(",")}`);
    return area.kind === "ward" ? { ...NO_FACTS, areaKm2: 1.5 } : NO_FACTS;
  }
}

// Validates like the Dynamo repository, so every row the job writes passes ward_scores, insights included.
class InMemoryScores implements ScoreRepository {
  readonly rows = new Map<string, WardScores>();

  async save(row: ComputedAreaScores): Promise<void> {
    this.rows.set(`${row.area.kind}:${row.area.id}`, validateWardScores(row));
  }

  async find(area: AreaKey): Promise<WardScores | null> {
    return this.rows.get(area.toString()) ?? null;
  }
}

function setup(sites: AreaSite[]) {
  const sink = new LogSink();
  const logger = new JsonLoggerFactory(sink).create({ service: "scores", stage: "dev" });
  const ports = { sites: new FakeSites(sites), reports: new FakeReports(), facts: new FakeFacts(), scores: new InMemoryScores() };
  return { ...ports, sink, job: new ScoresJob(ports, ScoreCalculator.standard(), new AreaGrouper(), logger) };
}

const everyArea = [WARD, ASSEMBLY, LOKSABHA, DISTRICT];

describe("ScoresJob", () => {
  it("scores every ward, assembly seat, Lok Sabha seat and district that holds a site", async () => {
    const { job, scores, facts } = setup([
      site({ siteId: "site_a", areas: everyArea, verifiedCount: 6 }),
      site({ siteId: "site_b", areas: [ASSEMBLY, LOKSABHA, DISTRICT], verifiedCount: 5, localBodyId: null }),
    ]);
    expect(await job.run(NOW)).toEqual({ sites: 2, areas: 4, failed: 0 });
    expect([...scores.rows.keys()].sort()).toEqual(
      ["assembly:s20-ac-127", "district:rajasthan-jodhpur", "loksabha:s20-pc-16", "ward:jodhpur-mc-w37"],
    );
    expect(scores.rows.get("ward:jodhpur-mc-w37")?.counts.verified_reports).toBe(6);
    expect(scores.rows.get("assembly:s20-ac-127")?.counts.verified_reports).toBe(11);
    expect(facts.asked).toContain("ward:jodhpur-mc-w37 jodhpur-mc");
  });

  it("gives an area whose sites were all rejected a zero-count, withheld row", async () => {
    const { job, scores } = setup([site({ areas: [OTHER_WARD], verification: "rejected", verifiedCount: 0 })]);
    await job.run(NOW);
    const row = scores.rows.get("ward:jodhpur-mc-w38");
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
    expect(scores.rows.get("ward:jodhpur-mc-w37")?.insights?.hour_of_day.reports).toBe(1);
  });

  it("logs a failing area by key and still scores the others", async () => {
    const { job, reports, scores, sink } = setup([
      site({ siteId: "site_bad", areas: [WARD, ASSEMBLY], verifiedCount: 2 }),
      site({ siteId: "site_ok", areas: [OTHER_WARD, ASSEMBLY], verifiedCount: 2 }),
    ]);
    reports.failFor = "site_bad";
    expect(await job.run(NOW)).toEqual({ sites: 2, areas: 3, failed: 2 });
    expect([...scores.rows.keys()]).toEqual(["ward:jodhpur-mc-w38"]);
    const failures = sink.records().filter((record) => record.message === "area scoring failed");
    expect(failures.map((record) => record.area)).toEqual(["ward:jodhpur-mc-w37", "assembly:s20-ac-127"]);
    expect(reports.asked.filter((id) => id === "site_bad")).toHaveLength(1);
  });

  it("overwrites each area's row on the next run", async () => {
    const { job, scores } = setup([site({ verifiedCount: 3 })]);
    await job.run(new Date("2026-10-19T00:00:00Z"));
    await job.run(NOW);
    expect(scores.rows.size).toBe(1);
    expect(scores.rows.get("ward:jodhpur-mc-w37")?.computed_at).toBe("2026-10-20T00:00:00Z");
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
    const summary = { level: "INFO", message: "scores done", sites: 1, areas: 1, failed: 0 };
    expect(sink.records()).toEqual([expect.objectContaining(summary)]);
  });

  it("fails the run after the summary when any area failed", async () => {
    const sink = new LogSink();
    const job = { run: async () => ({ sites: 3, areas: 4, failed: 1 }) };
    await expect(runScores(entryContext(sink), async () => job)).rejects.toThrow("1 of 4 areas failed");
    expect(sink.records()).toEqual([expect.objectContaining({ message: "scores done", failed: 1 })]);
  });

  it("refuses to start without the table names", async () => {
    await expect(runScores(entryContext(new LogSink()))).rejects.toThrow(/SITES_TABLE/);
  });
});
