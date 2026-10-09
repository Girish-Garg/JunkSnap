import { ScanCommand, type DynamoDBDocumentClient, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import type { AreaSiteReader, SiteRead } from "../ports/AreaSiteReader.js";
import type { SiteItemParser } from "./SiteItemParser.js";

// Scans the whole sites table, page by page; fine for a 15-minute CronJob at pilot scale.
export class DynamoAreaSiteReader implements AreaSiteReader {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #parser: SiteItemParser;

  constructor(client: DynamoDBDocumentClient, table: string, parser: SiteItemParser) {
    this.#client = client;
    this.#table = table;
    this.#parser = parser;
  }

  async readAll(): Promise<SiteRead> {
    const read: SiteRead = { sites: [], unreadable: [] };
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.#scan(startKey);
      for (const item of page.Items ?? []) {
        this.#add(read, item);
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return read;
  }

  // Only a contract break is per item; anything else is our bug or an outage and still stops the run.
  #add(read: SiteRead, item: Record<string, unknown>): void {
    try {
      read.sites.push(this.#parser.parse(item));
    } catch (error) {
      if (!(error instanceof InternalDataError)) {
        throw error;
      }
      const siteId = typeof item.site_id === "string" ? item.site_id : "unknown";
      read.unreadable.push({ siteId, error });
    }
  }

  async #scan(startKey: Record<string, unknown> | undefined): Promise<ScanCommandOutput> {
    try {
      return await this.#client.send(new ScanCommand({ TableName: this.#table, ExclusiveStartKey: startKey }));
    } catch (error) {
      throw new ExternalServiceError("DynamoDB scan of the sites table failed", { cause: error });
    }
  }
}
