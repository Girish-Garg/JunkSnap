import { GetCommand, type GetCommandOutput } from "@aws-sdk/lib-dynamodb";
import { siteSchema, validateSite, type Site } from "../../contracts/index.gen.js";
import { ExternalServiceError, InternalDataError } from "../../domain/errors.js";
import type { SiteReader } from "../../ports/letters/SiteReader.js";
import { LegacySiteFields } from "../sites/LegacySiteFields.js";

const PROPERTY_KEYS = Object.keys(siteSchema.properties.properties.properties);

export interface SiteGetter {
  send(command: GetCommand): Promise<GetCommandOutput>;
}

// The sites table holds site properties plus lat and lon; this rebuilds the contract Feature.
export class DynamoSiteReader implements SiteReader {
  readonly #client: SiteGetter;
  readonly #table: string;

  constructor(client: SiteGetter, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async find(siteId: string): Promise<Site | null> {
    const item = await this.#get(siteId);
    return item === undefined ? null : DynamoSiteReader.#feature(item);
  }

  async #get(siteId: string): Promise<Record<string, unknown> | undefined> {
    try {
      const output = await this.#client.send(new GetCommand({ TableName: this.#table, Key: { site_id: siteId } }));
      return output.Item;
    } catch (error) {
      throw new ExternalServiceError(`Could not read site ${siteId} from ${this.#table}`, { cause: error });
    }
  }

  // Rows from before decision 20261010-1530 read as the new shape, as for the map and area letters.
  static #feature(stored: Record<string, unknown>): Site {
    const item = new LegacySiteFields().upgrade(stored);
    const properties = Object.fromEntries(PROPERTY_KEYS.filter((key) => key in item).map((key) => [key, item[key]]));
    const geometry = { type: "Point", coordinates: [item.lon, item.lat] };
    try {
      return validateSite({ type: "Feature", geometry, properties });
    } catch (error) {
      throw new InternalDataError(`Stored site ${String(item.site_id)} breaks the site contract`, { cause: error });
    }
  }
}
