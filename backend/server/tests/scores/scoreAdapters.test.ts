import { readFileSync } from "node:fs";
import {
  GetCommand,
  PutCommand,
  type DynamoDBDocumentClient,
  type QueryCommand,
  type ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoAreaReportReader } from "../../src/adapters/DynamoAreaReportReader.js";
import { DynamoAreaSiteReader } from "../../src/adapters/DynamoAreaSiteReader.js";
import { DynamoScoreRepository } from "../../src/adapters/DynamoScoreRepository.js";
import { SiteItemParser } from "../../src/adapters/SiteItemParser.js";
import type { AreaScoresRow } from "../../src/domain/AreaInsights.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { ExternalServiceError, InternalDataError } from "../../src/domain/errors.js";
import { ScoreCalculator } from "../../src/services/ScoreCalculator.js";
import { NO_FACTS, NOW, site, WARD } from "./siteBuilder.js";

type Item = Record<string, unknown>;

// Answers each command from a script, records it, and stores puts by area key.
class FakeDocumentClient {
  readonly sent: unknown[] = [];
  readonly stored = new Map<string, Item>();
  readonly #pages: Item[];

  constructor(pages: Item[] = []) {
    this.#pages = pages;
  }

  async send(command: unknown): Promise<unknown> {
    this.sent.push(command);
    if (command instanceof PutCommand) {
      const item = command.input.Item ?? {};
      this.stored.set(`${String(item.area_kind)}:${String(item.area_id)}`, item);
      return {};
    }
    if (command instanceof GetCommand) {
      const key = command.input.Key ?? {};
      return { Item: this.stored.get(`${String(key.area_kind)}:${String(key.area_id)}`) };
    }
    return this.#pages.shift() ?? {};
  }

  asClient(): DynamoDBDocumentClient {
    return this as unknown as DynamoDBDocumentClient;
  }
}

function siteItem(sample: string): Item {
  const url = new URL(`../../../../contracts/fixtures/site.${sample}.json`, import.meta.url);
  const feature = JSON.parse(readFileSync(url, "utf8")) as { geometry: { coordinates: [number, number] }; properties: Item };
  const [lon, lat] = feature.geometry.coordinates;
  return { ...feature.properties, lat, lon, geohash4: "tsq4", report_ids: ["rpt_x"] };
}

describe("SiteItemParser", () => {
  const parser = new SiteItemParser();

  it.each([
    ["jdh-1", ["ward", "assembly", "loksabha", "district"]],
    ["jpr-1", ["assembly", "loksabha", "district"]],
  ])("reads the %s site item with its areas", (sample, kinds) => {
    const parsed = parser.parse(siteItem(sample));
    expect(parsed.id).toBe(`site_${sample.replace("-", "_")}`);
    expect(parsed.areas.map((area) => area.kind)).toEqual(kinds);
  });

  it("treats a missing ward or cleaned_at like null", () => {
    const item = siteItem("jdh-3");
    const location = { ...(item.location as Item) };
    delete location.ward;
    const parsed = parser.parse({ ...item, location, cleaned_at: undefined });
    expect(parsed.areas.map((area) => area.kind)).toEqual(["assembly", "loksabha", "district"]);
    expect(parsed.clearedWithinDays(365)).toBe(false);
  });

  it("reads site insights when present", () => {
    const insights = { reports: 2, composition: [{ material: "plastic", share_pct: 50, reports: 2, sources: [] }], size_class: null, hazards: [], near: [] };
    expect(parser.parse({ ...siteItem("jdh-1"), insights }).compositionEstimate()).toMatchObject({ reports: 2 });
  });

  it("throws InternalDataError naming the site for a bad item", () => {
    expect(() => parser.parse({ ...siteItem("jdh-2"), verified_count: -1 })).toThrow(InternalDataError);
    expect(() => parser.parse({ ...siteItem("jdh-2"), lat: undefined })).toThrow(/site_jdh_2/);
  });
});

describe("DynamoAreaSiteReader", () => {
  it("scans every page of the sites table", async () => {
    const fake = new FakeDocumentClient([
      { Items: [siteItem("jdh-1")], LastEvaluatedKey: { site_id: "site_jdh_1" } },
      { Items: [siteItem("jdh-2"), siteItem("jpr-1")] },
    ]);
    const sites = await new DynamoAreaSiteReader(fake.asClient(), "junksnap-dev-sites", new SiteItemParser()).readAll();
    expect(sites.map((each) => each.id)).toEqual(["site_jdh_1", "site_jdh_2", "site_jpr_1"]);
    expect((fake.sent[1] as ScanCommand).input).toEqual({ TableName: "junksnap-dev-sites", ExclusiveStartKey: { site_id: "site_jdh_1" } });
  });

  it("wraps SDK failures in ExternalServiceError", async () => {
    const failing = { send: async () => Promise.reject(new Error("AccessDenied")) } as unknown as DynamoDBDocumentClient;
    await expect(new DynamoAreaSiteReader(failing, "t", new SiteItemParser()).readAll()).rejects.toThrow(ExternalServiceError);
  });
});

describe("DynamoAreaReportReader", () => {
  it("pages the by-site index and keeps only verified reports", async () => {
    const fake = new FakeDocumentClient([
      { Items: [{ status: "verified", captured_at: "2026-10-10T02:14:05Z" }], LastEvaluatedKey: { report_id: "rpt_1" } },
      { Items: [{ status: "community_check", captured_at: "2026-10-10T03:00:00Z" }, { status: "verified", captured_at: "2026-10-11T03:00:00Z" }] },
    ]);
    const times = await new DynamoAreaReportReader(fake.asClient(), "junksnap-dev-reports").verifiedReportTimes("site_jdh_1");
    expect(times).toEqual([Date.parse("2026-10-10T02:14:05Z"), Date.parse("2026-10-11T03:00:00Z")]);
    const query = (fake.sent[0] as QueryCommand).input;
    expect(query).toMatchObject({ IndexName: "by-site", ExpressionAttributeValues: { ":site": "site_jdh_1" } });
  });

  it("throws InternalDataError for a report without captured_at", async () => {
    const fake = new FakeDocumentClient([{ Items: [{ status: "verified" }] }]);
    await expect(new DynamoAreaReportReader(fake.asClient(), "t").verifiedReportTimes("site_x")).rejects.toThrow(InternalDataError);
  });
});

describe("DynamoScoreRepository", () => {
  const computed = () => ScoreCalculator.standard().calculate({ area: WARD, sites: [site()], facts: NO_FACTS, now: NOW });

  it("stores the row under area_kind and area_id and reads it back with its insights", async () => {
    const fake = new FakeDocumentClient();
    const repository = new DynamoScoreRepository(fake.asClient(), "junksnap-dev-scores");
    const row = computed();
    await repository.save(row);
    expect(fake.stored.get("ward:jodhpur-south-mc-w37")).toMatchObject({ area_kind: "ward", area_id: WARD.id, formula_version: "scores-v1" });
    expect(await repository.find(AreaKey.of(WARD))).toEqual(row);
  });

  it("reads a row the worker seeded without insights", async () => {
    const fake = new FakeDocumentClient();
    const seeded = JSON.parse(readFileSync(new URL("../../../../contracts/fixtures/ward_scores.jpr-1.json", import.meta.url), "utf8")) as AreaScoresRow;
    fake.stored.set("assembly:s20-ac-54", { area_kind: "assembly", area_id: "s20-ac-54", ...seeded });
    const repository = new DynamoScoreRepository(fake.asClient(), "t");
    expect(await repository.find(AreaKey.parse("assembly", "s20-ac-54"))).toEqual(seeded);
    expect(await repository.find(AreaKey.parse("ward", "nowhere-w1"))).toBeNull();
  });

  it("refuses to write or read a row that breaks the contract", async () => {
    const fake = new FakeDocumentClient();
    const repository = new DynamoScoreRepository(fake.asClient(), "t");
    const broken = { ...computed(), formula_version: undefined } as unknown as AreaScoresRow;
    await expect(repository.save(broken)).rejects.toThrow(InternalDataError);
    fake.stored.set("ward:jodhpur-south-mc-w37", { area_kind: "ward", area_id: WARD.id, area: WARD });
    await expect(repository.find(AreaKey.of(WARD))).rejects.toThrow(InternalDataError);
  });
});
