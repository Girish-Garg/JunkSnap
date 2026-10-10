import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../../domain/errors.js";
import type { ShownNote, StoredNote } from "../../domain/notes/Community.js";
import type { NoteStore } from "../../ports/notes/NoteStore.js";

// A site with more notes than this reads only the newest ones for its summary.
const MAX_PAGES = 5;

type Client = Pick<DynamoDBDocumentClient, "send">;

// The notes table: site_id, note_id (note_<ulid>, so newest sorts last); author_hash only, never the author.
export class DynamoNoteStore implements NoteStore {
  readonly #client: Client;
  readonly #table: string;

  constructor(client: Client, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async add(note: StoredNote): Promise<void> {
    const item = {
      site_id: note.siteId,
      note_id: note.noteId,
      author_hash: note.authorHash,
      status: note.text === null ? "hidden" : "shown",
      language: note.language,
      moderation: note.moderation,
      created_at: note.createdAt,
      ...(note.text === null ? {} : { text: note.text }),
    };
    const command = new PutCommand({ TableName: this.#table, Item: item, ConditionExpression: "attribute_not_exists(note_id)" });
    await this.#call(() => this.#client.send(command), "store a note");
  }

  async shownFor(siteId: string): Promise<ShownNote[]> {
    const notes: ShownNote[] = [];
    let startKey: Record<string, unknown> | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const output = await this.#call(() => this.#client.send(this.#query(siteId, startKey)), "read notes");
      notes.push(...(output.Items ?? []).flatMap(DynamoNoteStore.#shown));
      startKey = output.LastEvaluatedKey;
      if (startKey === undefined) {
        break;
      }
    }
    return notes;
  }

  #query(siteId: string, startKey: Record<string, unknown> | undefined): QueryCommand {
    return new QueryCommand({
      TableName: this.#table,
      KeyConditionExpression: "site_id = :site",
      FilterExpression: "#status = :shown",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":site": siteId, ":shown": "shown" },
      ScanIndexForward: false,
      ExclusiveStartKey: startKey,
    });
  }

  static #shown(item: Record<string, unknown>): ShownNote[] {
    const { text, author_hash: authorHash } = item;
    return typeof text === "string" && typeof authorHash === "string" ? [{ text, authorHash }] : [];
  }

  async #call<T>(send: () => Promise<T>, what: string): Promise<T> {
    try {
      return await send();
    } catch (error) {
      throw new ExternalServiceError(`Could not ${what} in ${this.#table}`, { cause: error });
    }
  }
}
