import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../../domain/errors.js";
import type { FlagAuthor, FlagText, StoredPhotoFlag } from "../../domain/flags/PhotoFlag.js";
import type { PhotoFlagStore } from "../../ports/flags/PhotoFlagStore.js";

// Notes sort as note_<ulid>; photo reports as flag#<photo>#<author hash>, so one person has one row per photo.
const FLAG_PREFIX = "flag#";

type Client = Pick<DynamoDBDocumentClient, "send">;
type Item = Record<string, unknown>;

// Photo reports in the notes table (decision 20261011-0310-hem-photo-flags): hashes only, never a user id or device token.
export class DynamoPhotoFlagStore implements PhotoFlagStore {
  readonly #client: Client;
  readonly #table: string;
  readonly #maxTextPages: number;

  // maxTextPages: NOTES_MAX_PAGES; a site with more photo reports reads only the first pages for its community analysis.
  constructor(client: Client, table: string, maxTextPages: number) {
    this.#client = client;
    this.#table = table;
    this.#maxTextPages = maxTextPages;
  }

  async put(flag: StoredPhotoFlag): Promise<void> {
    const item = {
      site_id: flag.siteId,
      note_id: `${FLAG_PREFIX}${flag.photoId}#${flag.authorHash}`,
      kind: "photo_flag",
      photo_id: flag.photoId,
      author_hash: flag.authorHash,
      device_hash: flag.deviceHash,
      reason: flag.reason,
      text_status: flag.textStatus,
      moderation: flag.moderation,
      created_at: flag.createdAt,
      ...(flag.text === null ? {} : { text: flag.text }),
    };
    await this.#call(() => this.#client.send(new PutCommand({ TableName: this.#table, Item: item })), "store a photo report");
  }

  async authorsOf(siteId: string, photoId: string): Promise<FlagAuthor[]> {
    const items = await this.#pages(siteId, `${FLAG_PREFIX}${photoId}#`, Number.POSITIVE_INFINITY);
    return items.flatMap(DynamoPhotoFlagStore.#author);
  }

  // Every report with its shown description, so the reader can tell which photos several people reported.
  async textsFor(siteId: string): Promise<FlagText[]> {
    const items = await this.#pages(siteId, FLAG_PREFIX, this.#maxTextPages);
    return items.flatMap(DynamoPhotoFlagStore.#text);
  }

  async #pages(siteId: string, prefix: string, maxPages: number): Promise<Item[]> {
    const items: Item[] = [];
    let startKey: Item | undefined;
    for (let page = 0; page < maxPages; page += 1) {
      const output = await this.#call(() => this.#client.send(this.#query(siteId, prefix, startKey)), "read photo reports");
      items.push(...(output.Items ?? []));
      startKey = output.LastEvaluatedKey;
      if (startKey === undefined) {
        break;
      }
    }
    return items;
  }

  #query(siteId: string, prefix: string, startKey: Item | undefined): QueryCommand {
    return new QueryCommand({
      TableName: this.#table,
      KeyConditionExpression: "site_id = :site AND begins_with(note_id, :prefix)",
      ExpressionAttributeValues: { ":site": siteId, ":prefix": prefix },
      ConsistentRead: true,
      ExclusiveStartKey: startKey,
    });
  }

  static #author(item: Item): FlagAuthor[] {
    const { author_hash: authorHash, device_hash: deviceHash } = item;
    return typeof authorHash === "string" && typeof deviceHash === "string" ? [{ authorHash, deviceHash }] : [];
  }

  static #text(item: Item): FlagText[] {
    const { text, text_status: status, photo_id: photoId } = item;
    const [author] = DynamoPhotoFlagStore.#author(item);
    if (author === undefined || typeof photoId !== "string") {
      return [];
    }
    return [{ photoId, author, text: status === "shown" && typeof text === "string" ? text : null }];
  }

  async #call<T>(send: () => Promise<T>, what: string): Promise<T> {
    try {
      return await send();
    } catch (error) {
      throw new ExternalServiceError(`Could not ${what} in ${this.#table}`, { cause: error });
    }
  }
}
