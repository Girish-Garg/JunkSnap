import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { isoSeconds } from "../domain/timeUtils.js";
import type { Clock } from "../ports/Clock.js";
import type { CrawlActivator, CrawlDistrict } from "../ports/CrawlActivator.js";
import type { AwsCalls } from "./sites/AwsCalls.js";

// The hourly crawler CronJob picks the district up within the hour, and a crawl takes under one more.
const NOT_QUEUED_YET = "attribute_not_exists(#status)";

export interface CrawlsTable {
  readonly table: string;
  readonly activateAfter: number;
  // CRAWL_EXPECTED_HOURS in ms, for expected_by.
  readonly expectedWithinMs: number;
}

// crawls row keyed by district_id: report ids gather in a string set until the threshold, then the row turns queued.
export class DynamoCrawlActivator implements CrawlActivator {
  readonly #client: DynamoDBDocumentClient;
  readonly #crawls: CrawlsTable;
  readonly #clock: Clock;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, crawls: CrawlsTable, clock: Clock, calls: AwsCalls) {
    this.#client = client;
    this.#crawls = crawls;
    this.#clock = clock;
    this.#calls = calls;
  }

  async activate(district: CrawlDistrict, reportId: string): Promise<void> {
    const seen = await this.#count(district, reportId);
    if (seen !== null && seen >= this.#crawls.activateAfter) {
      await this.#queue(district.id);
    }
  }

  // Reports seen so far, or null once the district is queued or crawled.
  async #count(district: CrawlDistrict, reportId: string): Promise<number | null> {
    const request = new UpdateCommand({
      TableName: this.#crawls.table,
      Key: { district_id: district.id },
      UpdateExpression: "ADD verified_report_ids :ids SET district_name = if_not_exists(district_name, :name)",
      ConditionExpression: NOT_QUEUED_YET,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":ids": new Set([reportId]), ":name": district.name },
      ReturnValues: "ALL_NEW",
    });
    const output = await this.#calls.conditionalOutput("DynamoDB count crawl reports", () => this.#client.send(request));
    if (output === null) {
      return null;
    }
    const ids: unknown = output.Attributes?.["verified_report_ids"];
    return ids instanceof Set ? ids.size : 0;
  }

  async #queue(districtId: string): Promise<void> {
    const now = this.#clock.now();
    const request = new UpdateCommand({
      TableName: this.#crawls.table,
      Key: { district_id: districtId },
      UpdateExpression: "SET #status = :queued, queued_at = :now, next_due_at = :now, expected_by = :expected REMOVE verified_report_ids",
      ConditionExpression: NOT_QUEUED_YET,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":queued": "queued",
        ":now": isoSeconds(now),
        ":expected": isoSeconds(new Date(now.getTime() + this.#crawls.expectedWithinMs)),
      },
    });
    await this.#calls.conditional("DynamoDB queue crawl", () => this.#client.send(request));
  }
}
