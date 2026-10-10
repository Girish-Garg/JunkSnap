import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../../domain/errors.js";
import type { FlagAuthor, StoredPhotoFlag } from "../../domain/flags/PhotoFlag.js";
import type { ShownNote } from "../../domain/notes/Community.js";
import type { PhotoFlagStore } from "../../ports/flags/PhotoFlagStore.js";
import type { ReportNoteReader } from "../../ports/notes/NoteStore.js";

// Notes sort as note_<ulid>; photo reports as flag#<photo>#<author hash>, so one person has one row per photo.
const FLAG_PREFIX = "flag#";
// A site with more photo reports than this reads only the first pages for its community analysis.
const MAX_TEXT_PAGES = 5;

type Client = Pick<DynamoDBDocumentClient, "send">;
type Item = Record<string, unknown>;

// Photo reports in the notes table (decision 20261011-0310-hem-photo-flags): hashes only, never a user id or device token.
export class DynamoPhotoFlagStore implements PhotoFlagStore, ReportNoteReader {
  readonly #client: Client;
  readonly #table: string;

  constructor(client: Client, table: string) {
    this.#client = client;
    this.#table = table;
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

  // Shown descriptions only, for note_analysis as photo reports; never shown or quoted.
  async shownFor(siteId: string): Promise<ShownNote[]> {
    const items = await this.#pages(siteId, FLAG_PREFIX, MAX_TEXT_PAGES);
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

  static #text(item: Item): ShownNote[] {
    const { text, author_hash: authorHash, text_status: status } = item;
    const shown = status === "shown" && typeof text === "string" && typeof authorHash === "string";
    return shown ? [{ text, authorHash, source: "photo_report" }] : [];
  }

  async #call<T>(send: () => Promise<T>, what: string): Promise<T> {
    try {
      return await send();
    } catch (error) {
      throw new ExternalServiceError(`Could not ${what} in ${this.#table}`, { cause: error });
    }
  }
}
