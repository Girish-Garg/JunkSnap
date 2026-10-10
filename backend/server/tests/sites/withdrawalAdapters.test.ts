import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { AwsCalls } from "../../src/adapters/sites/AwsCalls.js";
import { DynamoReportWithdrawer } from "../../src/adapters/sites/DynamoReportWithdrawer.js";
import { DynamoSiteReportReader } from "../../src/adapters/sites/DynamoSiteReportReader.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { BASE_URL, DEVICE_A, DEVICE_B } from "./builders.js";
import { conditionFailed, ScriptedClient } from "./ScriptedClient.js";

const calls = new AwsCalls();
const dynamo = (client: ScriptedClient) => client.as<DynamoDBDocumentClient>();
const LABEL = { brand: "Sample Namkeen", parent_company: "Sample Foods Pvt Ltd", mapping_source_url: "https://example.org/brand-map/sample-namkeen" };
const ROW = {
  report_id: "rpt_a",
  site_id: "site_a",
  user_id: "user-a",
  device_token: DEVICE_A,
  captured_at: "2026-10-10T02:14:05Z",
  status: "unverified",
  brand_labels: [{ ...LABEL, confidence: 0.93 }, { ...LABEL, brand: "Faint", confidence: 0.5 }],
  moderation_result: { outcome: "passed", blurred_key: "media/reports/rpt_a.jpg" },
};

describe("DynamoSiteReportReader", () => {
  it("reads every page of the by-site index into report refs, keeping only readable labels", async () => {
    const guest = { report_id: "rpt_b", device_token: DEVICE_B, captured_at: "2026-10-10T03:00:00Z" };
    const client = new ScriptedClient([() => ({ Items: [ROW], LastEvaluatedKey: { report_id: "rpt_a" } }), () => ({ Items: [guest] })]);
    const reader = new DynamoSiteReportReader(dynamo(client), "junksnap-dev-reports", new PublicMedia(BASE_URL), calls);
    const rows = await reader.forSite("site_a");
    expect(rows).toEqual([
      {
        reportId: "rpt_a",
        userId: "user-a",
        deviceToken: DEVICE_A,
        reportedAt: "2026-10-10T02:14:05Z",
        brands: [{ brand: "Sample Namkeen", parent_company: "Sample Foods Pvt Ltd", confidence: 0.93, source_url: LABEL.mapping_source_url }],
        photoUrl: `${BASE_URL}/media/reports/rpt_a.jpg`,
      },
      { reportId: "rpt_b", userId: null, deviceToken: DEVICE_B, reportedAt: "2026-10-10T03:00:00Z", brands: [], photoUrl: null },
    ]);
    expect(client.sent[0]?.input).toMatchObject({ IndexName: "by-site", ExpressionAttributeValues: { ":site": "site_a" } });
    expect(client.sent[1]?.input.ExclusiveStartKey).toEqual({ report_id: "rpt_a" });
  });

  it("treats a malformed row as our bug", async () => {
    const client = new ScriptedClient([() => ({ Items: [{ report_id: "rpt_x" }] })]);
    const reader = new DynamoSiteReportReader(dynamo(client), "junksnap-dev-reports", new PublicMedia(BASE_URL), calls);
    await expect(reader.forSite("site_a")).rejects.toThrow(InternalDataError);
  });
});

describe("DynamoReportWithdrawer", () => {
  it("sets withdrawn only on a settled, unverified or rejected report, and skips one that no longer matches", async () => {
    const client = new ScriptedClient([() => ({}), conditionFailed]);
    const withdrawer = new DynamoReportWithdrawer(dynamo(client), "junksnap-dev-reports", calls);
    await withdrawer.markWithdrawn(["rpt_a", "rpt_b"], "2026-10-10T06:00:00Z");
    expect(client.sent).toHaveLength(2);
    expect(client.sent[0]?.input).toMatchObject({
      Key: { report_id: "rpt_a" },
      ConditionExpression: "#status IN (:unverified, :rejected, :community_check)",
      ExpressionAttributeValues: expect.objectContaining({ ":withdrawn": "withdrawn", ":at": "2026-10-10T06:00:00Z" }),
    });
  });
});
