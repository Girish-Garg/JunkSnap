import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DisabledCrawlActivator } from "../../src/adapters/DisabledCrawlActivator.js";
import { DynamoCrawlActivator } from "../../src/adapters/DynamoCrawlActivator.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { AwsCalls } from "../../src/adapters/sites/AwsCalls.js";
import type { LocationLookup } from "../../src/contracts/index.gen.js";
import { ConfigError, ExternalServiceError } from "../../src/domain/errors.js";
import { Report } from "../../src/domain/Report.js";
import type { MergeOutcome, ReportRecord } from "../../src/domain/ReportRecord.js";
import type { CrawlActivator, CrawlDistrict } from "../../src/ports/CrawlActivator.js";
import { ActivatingReportMerger } from "../../src/services/wiring/ActivatingReportMerger.js";
import { CrawlSettings } from "../../src/settings/CrawlSettings.js";
import { LogSink } from "../LogSink.js";
import { FakeMerger, FixedClock, fixture, Journal, upload } from "../reportFakes.js";
import { conditionFailed, failure, ScriptedClient } from "../sites/ScriptedClient.js";

const TABLE = "junksnap-dev-crawls";
const NOW = "2026-10-10T09:30:15.250Z";
const DISTRICT: CrawlDistrict = { id: "rajasthan-jodhpur", name: "Jodhpur" };
const counted = (...ids: string[]) => () => ({ Attributes: { district_id: DISTRICT.id, verified_report_ids: new Set(ids) } });

function activator(client: ScriptedClient, activateAfter = 1): DynamoCrawlActivator {
  const crawls = { table: TABLE, activateAfter };
  return new DynamoCrawlActivator(client.as<DynamoDBDocumentClient>(), crawls, new FixedClock(NOW), new AwsCalls());
}

describe("DynamoCrawlActivator", () => {
  it("adds the report id and queues the district on its first verified report", async () => {
    const client = new ScriptedClient([counted("rpt_a")]);
    await activator(client).activate(DISTRICT, "rpt_a");
    expect(client.sent.map((command) => command.name)).toEqual(["UpdateCommand", "UpdateCommand"]);
    expect(client.sent[0]?.input).toMatchObject({
      TableName: TABLE,
      Key: { district_id: "rajasthan-jodhpur" },
      UpdateExpression: "ADD verified_report_ids :ids SET district_name = if_not_exists(district_name, :name)",
      ConditionExpression: "attribute_not_exists(#status)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":ids": new Set(["rpt_a"]), ":name": "Jodhpur" },
      ReturnValues: "ALL_NEW",
    });
    expect(client.sent[1]?.input).toMatchObject({
      Key: { district_id: "rajasthan-jodhpur" },
      UpdateExpression: expect.stringContaining("REMOVE verified_report_ids"),
      ConditionExpression: "attribute_not_exists(#status)",
      ExpressionAttributeValues: { ":queued": "queued", ":now": "2026-10-10T09:30:15Z", ":expected": "2026-10-10T11:30:15Z" },
    });
  });

  it("only counts below CRAWL_ACTIVATE_AFTER, and a retried report id counts once", async () => {
    const client = new ScriptedClient([counted("rpt_a", "rpt_b"), counted("rpt_a", "rpt_b")]);
    await activator(client, 3).activate(DISTRICT, "rpt_b");
    await activator(client, 3).activate(DISTRICT, "rpt_b");
    expect(client.sent.map((command) => command.name)).toEqual(["UpdateCommand", "UpdateCommand"]);
  });

  it("stops when the district is already queued or crawled", async () => {
    const client = new ScriptedClient([conditionFailed]);
    await activator(client).activate(DISTRICT, "rpt_a");
    expect(client.sent).toHaveLength(1);
  });

  it("ignores a lost race to queue the district", async () => {
    const client = new ScriptedClient([counted("rpt_a"), conditionFailed]);
    await expect(activator(client).activate(DISTRICT, "rpt_a")).resolves.toBeUndefined();
  });

  it("reports other DynamoDB failures as ExternalServiceError", async () => {
    const client = new ScriptedClient([failure("ProvisionedThroughputExceededException")]);
    await expect(activator(client).activate(DISTRICT, "rpt_a")).rejects.toThrow(ExternalServiceError);
  });

  it("does nothing when disabled", async () => {
    await expect(new DisabledCrawlActivator().activate()).resolves.toBeUndefined();
  });
});

class RecordingActivator implements CrawlActivator {
  readonly calls: [CrawlDistrict, string][] = [];

  constructor(readonly fail = false) {}

  async activate(district: CrawlDistrict, reportId: string): Promise<void> {
    this.calls.push([district, reportId]);
    return this.fail ? Promise.reject(new ExternalServiceError("DynamoDB count crawl reports failed")) : Promise.resolve();
  }
}

describe("ActivatingReportMerger", () => {
  const location = () => fixture<LocationLookup>("location_lookup.jdh-1");
  const record = (located = true): ReportRecord => {
    const base = Report.receive(upload(), "2026-10-10T02:14:52Z").toRecord();
    return located ? { ...base, location: location() } : base;
  };

  function subject(outcome: MergeOutcome, activator: RecordingActivator) {
    const sink = new LogSink();
    const logger = new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
    return { sink, merger: new ActivatingReportMerger(new FakeMerger(new Journal(), outcome), activator, logger) };
  }

  it("queues the district of a verified report and returns the merge outcome", async () => {
    const activator = new RecordingActivator();
    const outcome: MergeOutcome = { siteId: "site_jdh_1", verification: "verified" };
    const report = record();
    expect(await subject(outcome, activator).merger.merge(report)).toEqual(outcome);
    expect(activator.calls).toEqual([[{ id: "rajasthan-jodhpur", name: "Jodhpur" }, report.report_id]]);
  });

  it.each(["unverified", "rejected"] as const)("leaves the district alone for a %s report", async (verification) => {
    const activator = new RecordingActivator();
    await subject({ siteId: "site_jdh_1", verification }, activator).merger.merge(record());
    expect(activator.calls).toEqual([]);
  });

  it("skips a report without a location", async () => {
    const activator = new RecordingActivator();
    await subject({ siteId: "site_jdh_1", verification: "verified" }, activator).merger.merge(record(false));
    expect(activator.calls).toEqual([]);
  });

  it("logs a failed activation without personal data and still settles the report", async () => {
    const { sink, merger } = subject({ siteId: "site_jdh_1", verification: "verified" }, new RecordingActivator(true));
    const report = record();
    await expect(merger.merge(report)).resolves.toEqual({ siteId: "site_jdh_1", verification: "verified" });
    const warning = sink.records().find((line) => line.level === "WARN");
    expect(warning).toMatchObject({ district_id: "rajasthan-jodhpur", report_id: report.report_id });
    expect(JSON.stringify(warning)).not.toContain(report.device_token);
  });
});

describe("CrawlSettings", () => {
  it("is disabled without CRAWLS_TABLE and activates after one report by default", () => {
    expect(CrawlSettings.fromEnv({})).toMatchObject({ crawlsTable: null, activateAfter: 1 });
    expect(CrawlSettings.fromEnv({ CRAWLS_TABLE: " " })).toMatchObject({ crawlsTable: null });
  });

  it("reads the table and the threshold", () => {
    const settings = CrawlSettings.fromEnv({ CRAWLS_TABLE: TABLE, CRAWL_ACTIVATE_AFTER: "3" });
    expect(settings).toMatchObject({ crawlsTable: TABLE, activateAfter: 3 });
  });

  it.each(["0", "1.5", "many"])("refuses CRAWL_ACTIVATE_AFTER=%s", (value) => {
    expect(() => CrawlSettings.fromEnv({ CRAWL_ACTIVATE_AFTER: value })).toThrow(ConfigError);
  });
});
