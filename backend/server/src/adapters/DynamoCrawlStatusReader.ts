import { GetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { validateAreaCrawl, type AreaCrawl } from "../contracts/index.gen.js";
import { expectsWards, notStartedCrawl } from "../domain/CrawlStatus.js";
import { InternalDataError } from "../domain/errors.js";
import type { CrawlStatusReader } from "../ports/CrawlStatusReader.js";
import type { AwsCalls } from "./sites/AwsCalls.js";

type Item = Readonly<Record<string, unknown>>;

const PROJECTION = "#status, queued_at, last_crawled_at, next_due_at, expected_by, wards_found";

// One GetItem on the crawls table; the row's working fields (results, error, attempts) never leave the api.
export class DynamoCrawlStatusReader implements CrawlStatusReader {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, table: string, calls: AwsCalls) {
    this.#client = client;
    this.#table = table;
    this.#calls = calls;
  }

  async get(districtId: string): Promise<AreaCrawl> {
    const request = new GetCommand({
      TableName: this.#table,
      Key: { district_id: districtId },
      ProjectionExpression: PROJECTION,
      ExpressionAttributeNames: { "#status": "status" },
    });
    const output = await this.#calls.run("DynamoDB read crawl status", () => this.#client.send(request));
    // A row without a status is still counting verified reports below CRAWL_ACTIVATE_AFTER.
    if (output.Item?.["status"] === undefined) {
      return notStartedCrawl(districtId);
    }
    return DynamoCrawlStatusReader.#checked(DynamoCrawlStatusReader.#mapped(districtId, output.Item));
  }

  static #mapped(districtId: string, item: Item): object {
    const status = item["status"];
    return {
      district_id: districtId,
      status,
      queued_at: DynamoCrawlStatusReader.#text(item, "queued_at"),
      last_crawled_at: DynamoCrawlStatusReader.#text(item, "last_crawled_at"),
      next_due_at: DynamoCrawlStatusReader.#text(item, "next_due_at"),
      expected_by: expectsWards(status) ? DynamoCrawlStatusReader.#text(item, "expected_by") : null,
      wards_found: typeof item["wards_found"] === "number" ? item["wards_found"] : null,
    };
  }

  static #text(item: Item, field: string): string | null {
    const value = item[field];
    return typeof value === "string" ? value : null;
  }

  static #checked(body: object): AreaCrawl {
    try {
      return validateAreaCrawl(body);
    } catch (error) {
      throw new InternalDataError("crawls row breaks the area_crawl contract", { cause: error });
    }
  }
}
