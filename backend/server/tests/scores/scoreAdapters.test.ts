import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
  type ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoAreaReportReader } from "../../src/adapters/DynamoAreaReportReader.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { DynamoAreaSiteReader } from "../../src/adapters/DynamoAreaSiteReader.js";
import { DynamoScoreLister } from "../../src/adapters/DynamoScoreLister.js";
import { DynamoScoreRepository } from "../../src/adapters/DynamoScoreRepository.js";
import { SiteItemParser } from "../../src/adapters/SiteItemParser.js";
import type { Site, WardScores } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import type { AreaSite } from "../../src/domain/AreaSite.js";
import { ExternalServiceError, InternalDataError } from "../../src/domain/errors.js";
import { ScoreCalculator } from "../../src/services/ScoreCalculator.js";
import { LogSink } from "../LogSink.js";
import { NO_FACTS, NOW, readContract, site, WARD } from "./siteBuilder.js";

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

const siteFixture = (sample: string) => readContract<Site>(`fixtures/site.${sample}.json`);

// A sites-table item: the site properties plus lat, lon and fields the contract does not show.
function siteItem(sample: string): Item {
  const { geometry, properties } = siteFixture(sample);
  const [lon, lat] = geometry.coordinates;
  return { ...properties, lat, lon, geohash4: "tsq4", report_ids: ["rpt_x"], device_tokens: ["d"] };
}

function expectedKinds({ properties: { location } }: Site): string[] {
  const refs = { ward: location.ward, assembly: location.assembly_seat, loksabha: location.loksabha_seat, district: location.district };
  return Object.entries(refs).flatMap(([kind, ref]) => (ref ? [kind] : []));
}

describe("SiteItemParser", () => {
  const parser = new SiteItemParser();

  it.each(["jdh-1", "jdh-2", "jdh-3", "jpr-1"])("reads the %s site item with its areas and local body", (sample) => {
    const fixture = siteFixture(sample);
    const parsed = parser.parse(siteItem(sample));
    expect(parsed.id).toBe(fixture.properties.site_id);
    expect(parsed.areas.map((area) => area.kind)).toEqual(expectedKinds(fixture));
    expect(parsed.localBodyId).toBe(fixture.properties.location.local_body?.id ?? null);
  });

  it("keeps the site insights, near-places included", () => {
    const fixture = siteFixture("jdh-3");
    const parsed = parser.parse(siteItem("jdh-3"));
    const kinds = new Set(fixture.properties.insights?.near.map((place) => place.kind));
    expect(parsed.isNear(kinds)).toBe(kinds.size > 0);
    expect(parsed.compositionEstimate()?.reports).toBe(fixture.properties.insights?.reports);
  });

  it("throws InternalDataError naming the site for an item that breaks the contract", () => {
    expect(() => parser.parse({ ...siteItem("jdh-2"), verified_count: -1 })).toThrow(InternalDataError);
    expect(() => parser.parse({ ...siteItem("jdh-2"), lat: undefined })).toThrow(/site_jdh_2/);
    const withoutCleanedAt = siteItem("jdh-2");
    delete withoutCleanedAt.cleaned_at;
    expect(() => parser.parse(withoutCleanedAt)).toThrow(InternalDataError);
  });
});

describe("DynamoAreaSiteReader", () => {
  it("scans every page of the sites table", async () => {
    const fake = new FakeDocumentClient([
      { Items: [siteItem("jdh-1")], LastEvaluatedKey: { site_id: "site_jdh_1" } },
      { Items: [siteItem("jdh-2"), siteItem("jpr-1")] },
    ]);
    const read = await new DynamoAreaSiteReader(fake.asClient(), "junksnap-dev-sites", new SiteItemParser()).readAll();
    const ids = ["jdh-1", "jdh-2", "jpr-1"].map((sample) => siteFixture(sample).properties.site_id);
    expect(read.sites.map((each) => each.id)).toEqual(ids);
    expect(read.unreadable).toEqual([]);
    expect((fake.sent[1] as ScanCommand).input).toEqual({ TableName: "junksnap-dev-sites", ExclusiveStartKey: { site_id: "site_jdh_1" } });
  });

  it("returns an item that breaks the site contract as unreadable, with its site id, and keeps the rest", async () => {
    const broken = siteItem("jdh-2");
    delete broken.cleaned_at;
    const fake = new FakeDocumentClient([{ Items: [siteItem("jdh-1"), broken, siteItem("jpr-1")] }]);
    const read = await new DynamoAreaSiteReader(fake.asClient(), "t", new SiteItemParser()).readAll();
    expect(read.sites.map((each) => each.id)).toEqual(["jdh-1", "jpr-1"].map((sample) => siteFixture(sample).properties.site_id));
    expect(read.unreadable).toEqual([{ siteId: siteFixture("jdh-2").properties.site_id, error: expect.any(InternalDataError) }]);
    expect(read.unreadable[0]?.error.message).toContain("cleaned_at");
  });

  it("stops the run when parsing fails for any reason other than the site contract", async () => {
    class BrokenParser extends SiteItemParser {
      override parse(): AreaSite {
        throw new TypeError("parser bug");
      }
    }
    const fake = new FakeDocumentClient([{ Items: [siteItem("jdh-1")] }]);
    await expect(new DynamoAreaSiteReader(fake.asClient(), "t", new BrokenParser()).readAll()).rejects.toThrow("parser bug");
  });

  it("wraps SDK failures in ExternalServiceError", async () => {
    const failing = { send: async () => Promise.reject(new Error("AccessDenied")) } as unknown as DynamoDBDocumentClient;
    await expect(new DynamoAreaSiteReader(failing, "t", new SiteItemParser()).readAll()).rejects.toThrow(ExternalServiceError);
  });
});

describe("DynamoAreaReportReader", () => {
  function reader(pages: Item[]) {
    const sink = new LogSink();
    const logger = new JsonLoggerFactory(sink).create({ service: "scores", stage: "dev" });
    const fake = new FakeDocumentClient(pages);
    return { fake, sink, reader: new DynamoAreaReportReader(fake.asClient(), "junksnap-dev-reports", logger) };
  }

  it("pages the by-site index and keeps only verified reports", async () => {
    const { fake, reader: reports } = reader([
      { Items: [{ status: "verified", captured_at: "2026-10-10T02:14:05Z" }], LastEvaluatedKey: { report_id: "rpt_1" } },
      { Items: [{ status: "community_check", captured_at: "2026-10-10T03:00:00Z" }, { status: "verified", captured_at: "2026-10-11T03:00:00Z" }] },
    ]);
    const times = await reports.verifiedReportTimes("site_jdh_1");
    expect(times).toEqual([Date.parse("2026-10-10T02:14:05Z"), Date.parse("2026-10-11T03:00:00Z")]);
    const query = (fake.sent[0] as QueryCommand).input;
    expect(query).toMatchObject({ IndexName: "by-site", ExpressionAttributeValues: { ":site": "site_jdh_1" } });
  });

  it("reads a captured_at with an offset, as the api's date-time check accepts it", async () => {
    const { reader: reports, sink } = reader([{ Items: [{ status: "verified", captured_at: "2026-10-11T09:00:00+05:30" }] }]);
    expect(await reports.verifiedReportTimes("site_jdh_1")).toEqual([Date.parse("2026-10-11T03:30:00Z")]);
    expect(sink.records()).toEqual([]);
  });

  it("logs and skips a row without a readable captured_at, keeping the site's other reports", async () => {
    const { reader: reports, sink } = reader([
      { Items: [{ report_id: "rpt_bad", status: "verified" }, { report_id: "rpt_odd", status: "verified", captured_at: "11/10/2026" }], LastEvaluatedKey: { report_id: "rpt_odd" } },
      { Items: [{ report_id: "rpt_good", status: "verified", captured_at: "2026-10-11T03:00:00Z" }] },
    ]);
    expect(await reports.verifiedReportTimes("site_x")).toEqual([Date.parse("2026-10-11T03:00:00Z")]);
    const warnings = sink.records().filter((record) => record.message === "skipped a report row");
    expect(warnings.map((record) => record.report_id)).toEqual(["rpt_bad", "rpt_odd"]);
    expect(warnings[0]).toMatchObject({ site_id: "site_x", index: "by-site" });
  });
});

describe("DynamoScoreRepository", () => {
  const computed = () => ScoreCalculator.standard().calculate({ area: WARD, sites: [site()], facts: NO_FACTS, now: NOW });

  it("stores the row under area_kind and area_id and reads it back with its insights", async () => {
    const fake = new FakeDocumentClient();
    const repository = new DynamoScoreRepository(fake.asClient(), "junksnap-dev-scores");
    const row = computed();
    await repository.save(row, ["jodhpur-mc", "rajasthan-jodhpur"]);
    const stored = fake.stored.get(AreaKey.of(WARD).toString());
    expect(stored).toMatchObject({ area_kind: WARD.kind, area_id: WARD.id, within: ["jodhpur-mc", "rajasthan-jodhpur"], formula_version: "scores-v3" });
    expect(await repository.find(AreaKey.of(WARD))).toEqual(row);
  });

  it.each(["jdh-1", "jpr-1"])("reads the ward_scores.%s fixture row", async (sample) => {
    const fixture = readContract<WardScores>(`fixtures/ward_scores.${sample}.json`);
    const fake = new FakeDocumentClient();
    const key = AreaKey.of(fixture.area);
    fake.stored.set(key.toString(), { area_kind: key.kind, area_id: key.id, ...fixture });
    const repository = new DynamoScoreRepository(fake.asClient(), "t");
    expect(await repository.find(key)).toEqual(fixture);
    expect(await repository.find(AreaKey.parse("ward", "nowhere-w1"))).toBeNull();
  });

  it("refuses to write or read a row that breaks the contract, insights included", async () => {
    const fake = new FakeDocumentClient();
    const repository = new DynamoScoreRepository(fake.asClient(), "t");
    const row = computed();
    const badInsights = { ...row, insights: { ...row.insights, hour_of_day: { value: [1], reports: 1, reason: null } } };
    await expect(repository.save(badInsights, [])).rejects.toThrow(InternalDataError);
    fake.stored.set(AreaKey.of(WARD).toString(), { area_kind: WARD.kind, area_id: WARD.id, area: WARD });
    await expect(repository.find(AreaKey.of(WARD))).rejects.toThrow(InternalDataError);
  });
});

describe("DynamoScoreLister", () => {
  const rowOf = (sample: string) => readContract<WardScores>(`fixtures/ward_scores.${sample}.json`);
  const itemOf = (sample: string) => {
    const row = rowOf(sample);
    return { area_kind: row.area.kind, area_id: row.area.id, within: ["rajasthan-jodhpur", "jodhpur-mc"], ...row };
  };

  it("queries the kind's partition filtered on within, reads every page and strips the table fields", async () => {
    const fake = new FakeDocumentClient([
      { Items: [itemOf("jdh-1")], LastEvaluatedKey: { area_kind: "assembly", area_id: "s20-ac-128" } },
      { Items: [itemOf("jpr-1")] },
    ]);
    const rows = await new DynamoScoreLister(fake.asClient(), "junksnap-dev-scores").listWithin("assembly", "rajasthan-jodhpur");
    expect(rows).toEqual([rowOf("jdh-1"), rowOf("jpr-1")]);
    expect(fake.sent.every((command) => command instanceof QueryCommand)).toBe(true);
    expect((fake.sent[0] as QueryCommand).input).toEqual({
      TableName: "junksnap-dev-scores",
      KeyConditionExpression: "area_kind = :kind",
      FilterExpression: "contains(#within, :within)",
      ExpressionAttributeNames: { "#within": "within" },
      ExpressionAttributeValues: { ":kind": "assembly", ":within": "rajasthan-jodhpur" },
      ExclusiveStartKey: undefined,
    });
    expect((fake.sent[1] as QueryCommand).input.ExclusiveStartKey).toEqual({ area_kind: "assembly", area_id: "s20-ac-128" });
  });

  it("returns an empty list when nothing matches", async () => {
    const fake = new FakeDocumentClient([{ Items: [] }]);
    expect(await new DynamoScoreLister(fake.asClient(), "t").listWithin("ward", "jodhpur-mc")).toEqual([]);
  });

  it("throws InternalDataError for a stored row that breaks the contract, ExternalServiceError when the SDK fails", async () => {
    const fake = new FakeDocumentClient([{ Items: [{ area_kind: "ward", area_id: "x", within: [], area: WARD }] }]);
    await expect(new DynamoScoreLister(fake.asClient(), "t").listWithin("ward", "jodhpur-mc")).rejects.toThrow(InternalDataError);
    const failing = { send: async () => Promise.reject(new Error("AccessDenied")) } as unknown as DynamoDBDocumentClient;
    await expect(new DynamoScoreLister(failing, "t").listWithin("ward", "jodhpur-mc")).rejects.toThrow(ExternalServiceError);
  });
});
