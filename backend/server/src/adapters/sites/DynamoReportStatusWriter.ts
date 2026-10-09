import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Verification } from "../../domain/sites/SiteTypes.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { ReportStatusWriter } from "../../ports/sites/ReportStatusWriter.js";
import type { AwsCalls } from "./AwsCalls.js";

// Report status values match site verification values one to one.
export class DynamoReportStatusWriter implements ReportStatusWriter {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #clock: Clock;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, table: string, clock: Clock, calls: AwsCalls) {
    this.#client = client;
    this.#table = table;
    this.#clock = clock;
    this.#calls = calls;
  }

  async followSite(reportIds: readonly string[], status: Verification): Promise<void> {
    const updatedAt = this.#clock.now().toISOString();
    await Promise.all(reportIds.map((reportId) => this.#update(reportId, status, updatedAt)));
  }

  // Only settled reports change; a queued or processing one is the worker's, which sets its status itself.
  async #update(reportId: string, status: Verification, updatedAt: string): Promise<void> {
    const request = new UpdateCommand({
      TableName: this.#table,
      Key: { report_id: reportId },
      // The version bump makes the worker's optimistic lock see this write.
      UpdateExpression: "SET #status = :status, updated_at = :updated ADD #version :one",
      ConditionExpression: "#status IN (:verified, :community_check) AND #status <> :status",
      ExpressionAttributeNames: { "#status": "status", "#version": "version" },
      ExpressionAttributeValues: {
        ":status": status,
        ":updated": updatedAt,
        ":one": 1,
        ":verified": "verified",
        ":community_check": "community_check",
      },
    });
    await this.#calls.conditional("DynamoDB update report status", () => this.#client.send(request));
  }
}
