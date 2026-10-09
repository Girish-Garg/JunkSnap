import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Verification } from "../../domain/sites/SiteTypes.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { ReportStatusWriter } from "../../ports/sites/ReportStatusWriter.js";
import { conditionalWrite } from "./utils.js";

// Report status values match site verification values one to one.
export class DynamoReportStatusWriter implements ReportStatusWriter {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #clock: Clock;

  constructor(client: DynamoDBDocumentClient, table: string, clock: Clock) {
    this.#client = client;
    this.#table = table;
    this.#clock = clock;
  }

  async followSite(reportIds: readonly string[], status: Verification): Promise<void> {
    const updatedAt = this.#clock.now().toISOString();
    await Promise.all(reportIds.map((reportId) => this.#update(reportId, status, updatedAt)));
  }

  // A report id with no item is skipped rather than created half-empty.
  async #update(reportId: string, status: Verification, updatedAt: string): Promise<void> {
    const request = new UpdateCommand({
      TableName: this.#table,
      Key: { report_id: reportId },
      UpdateExpression: "SET #status = :status, updated_at = :updated",
      ConditionExpression: "attribute_exists(report_id)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status, ":updated": updatedAt },
    });
    await conditionalWrite("DynamoDB update report status", () => this.#client.send(request));
  }
}
