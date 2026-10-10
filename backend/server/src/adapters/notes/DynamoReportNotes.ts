import { QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../../domain/errors.js";
import { authorHash } from "../../domain/notes/AuthorHash.js";
import type { ShownNote } from "../../domain/notes/Community.js";
import type { ReportNoteReader } from "../../ports/notes/NoteStore.js";

const BY_SITE_INDEX = "by-site";
const MAX_PAGES = 5;

type Client = Pick<DynamoDBDocumentClient, "send">;

// Report notes that note moderation passed, read through the reports table's by-site index.
export class DynamoReportNotes implements ReportNoteReader {
  readonly #client: Client;
  readonly #table: string;

  constructor(client: Client, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async shownFor(siteId: string): Promise<ShownNote[]> {
    const notes: ShownNote[] = [];
    let startKey: Record<string, unknown> | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const output = await this.#query(siteId, startKey);
      notes.push(...(output.Items ?? []).flatMap(DynamoReportNotes.#shown));
      startKey = output.LastEvaluatedKey;
      if (startKey === undefined) {
        break;
      }
    }
    return notes;
  }

  async #query(siteId: string, startKey: Record<string, unknown> | undefined) {
    const command = new QueryCommand({
      TableName: this.#table,
      IndexName: BY_SITE_INDEX,
      KeyConditionExpression: "site_id = :site",
      // A withdrawn report's note leaves with it (decision 20261010-1700).
      FilterExpression: "attribute_exists(note) AND (attribute_not_exists(#status) OR #status <> :withdrawn)",
      ProjectionExpression: "note, moderation_result, user_id, device_token, #status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":site": siteId, ":withdrawn": "withdrawn" },
      ExclusiveStartKey: startKey,
    });
    try {
      return await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError("Could not read report notes from the reports by-site index", { cause: error });
    }
  }

  static #shown(item: Record<string, unknown>): ShownNote[] {
    const moderation = item.moderation_result as { note_moderation?: { result?: unknown } | null } | undefined;
    const person = typeof item.user_id === "string" ? item.user_id : item.device_token;
    const clean = moderation?.note_moderation?.result === "clean" && item.status !== "withdrawn";
    return clean && typeof item.note === "string" && typeof person === "string" ? [{ text: item.note, authorHash: authorHash(person) }] : [];
  }
}
