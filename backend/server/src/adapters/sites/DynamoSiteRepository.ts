import { GetCommand, PutCommand, QueryCommand, ScanCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Site } from "../../domain/sites/Site.js";
import { StaleSiteError } from "../../domain/sites/SiteErrors.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { AwsCalls } from "./AwsCalls.js";
import type { SiteItem, SiteItemMapper } from "./SiteItemMapper.js";

const GEOHASH_INDEX = "by-geohash";

interface PutCondition {
  readonly expression: string;
  readonly values?: Record<string, unknown>;
}

// Optimistic locking on `version`: the worker (merge, cleanup) and the api (votes) write the same items.
export class DynamoSiteRepository implements SiteRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #mapper: SiteItemMapper;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, table: string, mapper: SiteItemMapper, calls: AwsCalls) {
    this.#client = client;
    this.#table = table;
    this.#mapper = mapper;
    this.#calls = calls;
  }

  async get(siteId: string): Promise<Site | null> {
    const request = new GetCommand({ TableName: this.#table, Key: { site_id: siteId }, ConsistentRead: true });
    const { Item } = await this.#calls.run("DynamoDB get site", () => this.#client.send(request));
    return Item === undefined ? null : this.#mapper.toSite(Item);
  }

  // Pages through every result; the GSI must project all attributes. A bad item is skipped.
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
      const page = await this.#calls.run("DynamoDB query sites", () => this.#client.send(request));
      items.push(...(page.Items ?? []));
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return items.flatMap((item) => this.#mapper.toListedSite(item) ?? []);
  }

  async allIds(): Promise<string[]> {
    const ids: string[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const request = new ScanCommand({ TableName: this.#table, ProjectionExpression: "site_id", ExclusiveStartKey: startKey });
      const page = await this.#calls.run("DynamoDB scan sites", () => this.#client.send(request));
      ids.push(...(page.Items ?? []).map((item) => String(item.site_id)));
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return ids;
  }

  async create(site: Site): Promise<boolean> {
    return this.#put(site, { expression: "attribute_not_exists(site_id)" });
  }

  // Version 0 is an item written before versioning, which has no version attribute.
  async save(site: Site): Promise<void> {
    const condition =
      site.version === 0
        ? { expression: "attribute_not_exists(version)" }
        : { expression: "version = :expected", values: { ":expected": site.version } };
    if (!(await this.#put(site, condition))) {
      throw new StaleSiteError(`${site.siteId} changed since version ${site.version}`);
    }
  }

  async #put(site: Site, condition: PutCondition): Promise<boolean> {
    const request = new PutCommand({
      TableName: this.#table,
      Item: this.#mapper.toItem(site),
      ConditionExpression: condition.expression,
      ExpressionAttributeValues: condition.values,
    });
    return this.#calls.conditional("DynamoDB put site", () => this.#client.send(request));
  }
}
