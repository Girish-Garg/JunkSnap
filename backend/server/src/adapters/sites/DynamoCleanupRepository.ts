import { GetCommand, PutCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import type { CleanupFinish, CleanupRecord } from "../../domain/sites/Cleanup.js";
import type { CleanupRepository } from "../../ports/sites/CleanupRepository.js";
import type { AwsCalls } from "./AwsCalls.js";

const StoredCleanup = z.object({
  cleanup_id: z.string(),
  site_id: z.string(),
  upload_id: z.string(),
  device_token: z.string(),
  user_id: z.string().nullable().default(null),
  sha256: z.string(),
  gps: z.object({ lat: z.number(), lon: z.number(), accuracy_m: z.number() }),
  captured_at: z.string(),
  received_at: z.string(),
  status: z.enum(["checking", "accepted", "rejected"]),
});

// The worker's moderation_result and verification_result are stored next to the record; user_id is left out for a guest.
export class DynamoCleanupRepository implements CleanupRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, table: string, calls: AwsCalls) {
    this.#client = client;
    this.#table = table;
    this.#calls = calls;
  }

  async get(cleanupId: string): Promise<CleanupRecord | null> {
    const request = new GetCommand({ TableName: this.#table, Key: { cleanup_id: cleanupId }, ConsistentRead: true });
    const { Item } = await this.#calls.run("DynamoDB get cleanup", () => this.#client.send(request));
    if (Item === undefined) {
      return null;
    }
    const parsed = StoredCleanup.safeParse(Item);
    if (!parsed.success) {
      throw new InternalDataError(`cleanup ${cleanupId} is malformed: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data;
  }

  async create(record: CleanupRecord): Promise<void> {
    const { user_id, ...fields } = record;
    const request = new PutCommand({
      TableName: this.#table,
      Item: user_id === null ? fields : { ...fields, user_id },
      ConditionExpression: "attribute_not_exists(cleanup_id)",
    });
    await this.#calls.conditional("DynamoDB put cleanup", () => this.#client.send(request));
  }

  async finish(cleanupId: string, result: CleanupFinish): Promise<void> {
    const request = new UpdateCommand({
      TableName: this.#table,
      Key: { cleanup_id: cleanupId },
      UpdateExpression: "SET #status = :status, moderation_result = :moderation, verification_result = :verification",
      ConditionExpression: "#status = :checking",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": result.status,
        ":moderation": result.moderation,
        ":verification": result.verification,
        ":checking": "checking",
      },
    });
    await this.#calls.conditional("DynamoDB finish cleanup", () => this.#client.send(request));
  }
}
