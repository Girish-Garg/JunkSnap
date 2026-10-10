import { ScanCommand, type ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import { siteSchema, validateSite, type Site } from "../../contracts/index.gen.js";
import type { AreaKey, AreaKind } from "../../domain/AreaKey.js";
import { ExternalServiceError } from "../../domain/errors.js";
import type { StoredAreaSite } from "../../domain/letters/AreaIssueSites.js";
import type { AreaLetterSites, AreaSiteBatch } from "../../ports/letters/AreaLetterSites.js";

const PROPERTY_KEYS = Object.keys(siteSchema.properties.properties.properties);

// site.location field that holds each area kind's ref.
const LOCATION_FIELD: Readonly<Record<AreaKind, string>> = {
  ward: "ward",
  assembly: "assembly_seat",
  loksabha: "loksabha_seat",
  district: "district",
};

export interface SiteScanner {
  send(command: ScanCommand): Promise<ScanCommandOutput>;
}

// A filtered scan of the sites table, page by page; fine at pilot scale for a few letters an hour.
export class DynamoAreaLetterSites implements AreaLetterSites {
  readonly #client: SiteScanner;
  readonly #table: string;

  constructor(client: SiteScanner, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async sitesIn(area: AreaKey): Promise<AreaSiteBatch> {
    const sites: StoredAreaSite[] = [];
    let unreadable = 0;
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.#scan(area, startKey);
      for (const item of page.Items ?? []) {
        const stored = DynamoAreaLetterSites.#stored(item);
        unreadable += stored === null ? 1 : 0;
        sites.push(...(stored === null ? [] : [stored]));
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return { sites, unreadable };
  }

  async #scan(area: AreaKey, startKey: Record<string, unknown> | undefined): Promise<ScanCommandOutput> {
    const command = new ScanCommand({
      TableName: this.#table,
      FilterExpression: "#location.#area.#id = :id",
      ExpressionAttributeNames: { "#location": "location", "#area": LOCATION_FIELD[area.kind], "#id": "id" },
      ExpressionAttributeValues: { ":id": area.id },
      ExclusiveStartKey: startKey,
    });
    try {
      return await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError(`DynamoDB scan of ${this.#table} for ${area.toString()} failed`, { cause: error });
    }
  }

  static #stored(item: Record<string, unknown>): StoredAreaSite | null {
    const properties = Object.fromEntries(PROPERTY_KEYS.filter((key) => key in item).map((key) => [key, item[key]]));
    let site: Site;
    try {
      site = validateSite({ type: "Feature", geometry: { type: "Point", coordinates: [item.lon, item.lat] }, properties });
    } catch {
      return null;
    }
    return { site, reporterIds: DynamoAreaLetterSites.#ids(item.reporter_ids ?? item.reporter_devices) };
  }

  static #ids(value: unknown): readonly string[] | null {
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : null;
  }
}
