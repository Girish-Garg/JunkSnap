import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ReportWithdrawer } from "../../ports/sites/ReportWithdrawer.js";
import type { AwsCalls } from "./AwsCalls.js";

// Decision 20261010-1700: the row stays for the audit trail; only its status and withdrawn_at change.
export class DynamoReportWithdrawer implements ReportWithdrawer {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, table: string, calls: AwsCalls) {
    this.#client = client;
    this.#table = table;
    this.#calls = calls;
  }

  async markWithdrawn(reportIds: readonly string[], at: string): Promise<void> {
    await Promise.all(reportIds.map((reportId) => this.#update(reportId, at)));
  }

  // A verified report never matches: a verified site keeps its reports.
  async #update(reportId: string, at: string): Promise<void> {
    const request = new UpdateCommand({
      TableName: this.#table,
      Key: { report_id: reportId },
      // The version bump makes the worker's optimistic lock see this write.
      UpdateExpression: "SET #status = :withdrawn, updated_at = :at, withdrawn_at = :at ADD #version :one",
      ConditionExpression: "#status IN (:unverified, :rejected, :community_check)",
      ExpressionAttributeNames: { "#status": "status", "#version": "version" },
      ExpressionAttributeValues: {
        ":withdrawn": "withdrawn",
        ":at": at,
        ":one": 1,
        ":unverified": "unverified",
        ":rejected": "rejected",
        ":community_check": "community_check",
      },
    });
    await this.#calls.conditional("DynamoDB withdraw report", () => this.#client.send(request));
  }
}
