import { GetCommand, PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Site } from "../../domain/sites/Site.js";
import { StaleSiteError } from "../../domain/sites/SiteErrors.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { SiteItem, SiteItemMapper } from "./SiteItemMapper.js";
import { awsCall, conditionalWrite } from "./utils.js";

const GEOHASH_INDEX = "by-geohash";

// Optimistic locking on `version`: the worker (merge, cleanup) and the api (votes) write the same items.
export class DynamoSiteRepository implements SiteRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #mapper: SiteItemMapper;

  constructor(client: DynamoDBDocumentClient, table: string, mapper: SiteItemMapper) {
    this.#client = client;
    this.#table = table;
    this.#mapper = mapper;
  }

  async get(siteId: string): Promise<Site | null> {
    const request = new GetCommand({ TableName: this.#table, Key: { site_id: siteId }, ConsistentRead: true });
    const { Item } = await awsCall("DynamoDB get site", () => this.#client.send(request));
    return Item === undefined ? null : this.#mapper.toSite(Item);
  }

  // Pages through every result; the GSI must project all attributes.
  async inCell(cell: string): Promise<Site[]> {
    const items: SiteItem[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const request = new QueryCommand({
        TableName: this.#table,
        IndexName: GEOHASH_INDEX,
        KeyConditionExpression: "geohash4 = :cell",
        ExpressionAttributeValues: { ":cell": cell },
        ExclusiveStartKey: startKey,
      });
      const page = await awsCall("DynamoDB query sites", () => this.#client.send(request));
      items.push(...(page.Items ?? []));
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return items.map((item) => this.#mapper.toSite(item));
  }

  async create(site: Site): Promise<boolean> {
    return this.#put(site, "attribute_not_exists(site_id)", undefined);
  }

  async save(site: Site): Promise<void> {
    const saved = await this.#put(site, "version = :expected", { ":expected": site.version });
    if (!saved) {
      throw new StaleSiteError(`${site.siteId} changed since version ${site.version}`);
    }
  }

  async #put(site: Site, condition: string, values: Record<string, unknown> | undefined): Promise<boolean> {
    const request = new PutCommand({
      TableName: this.#table,
      Item: this.#mapper.toItem(site),
      ConditionExpression: condition,
      ExpressionAttributeValues: values,
    });
    return conditionalWrite("DynamoDB put site", () => this.#client.send(request));
  }
}
