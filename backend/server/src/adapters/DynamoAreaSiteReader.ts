import { ScanCommand, type DynamoDBDocumentClient, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { AreaSite } from "../domain/AreaSite.js";
import { ExternalServiceError } from "../domain/errors.js";
import type { AreaSiteReader } from "../ports/AreaSiteReader.js";
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

  async readAll(): Promise<AreaSite[]> {
    const sites: AreaSite[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.#scan(startKey);
      sites.push(...(page.Items ?? []).map((item) => this.#parser.parse(item)));
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return sites;
  }

  async #scan(startKey: Record<string, unknown> | undefined): Promise<ScanCommandOutput> {
    try {
      return await this.#client.send(new ScanCommand({ TableName: this.#table, ExclusiveStartKey: startKey }));
    } catch (error) {
      throw new ExternalServiceError("DynamoDB scan of the sites table failed", { cause: error });
    }
  }
}
