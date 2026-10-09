import { GetCommand, PutCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import type { CleanupFinish, CleanupRecord } from "../../domain/sites/Cleanup.js";
import type { CleanupRepository } from "../../ports/sites/CleanupRepository.js";
import { awsCall, conditionalWrite } from "./utils.js";

const StoredCleanup = z.object({
  cleanup_id: z.string(),
  site_id: z.string(),
  upload_id: z.string(),
  device_token: z.string(),
  sha256: z.string(),
  gps: z.object({ lat: z.number(), lon: z.number(), accuracy_m: z.number() }),
  captured_at: z.string(),
  received_at: z.string(),
  status: z.enum(["checking", "accepted", "rejected"]),
});

// The worker's moderation_result and verification_result are stored next to the record.
export class DynamoCleanupRepository implements CleanupRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async get(cleanupId: string): Promise<CleanupRecord | null> {
    const request = new GetCommand({ TableName: this.#table, Key: { cleanup_id: cleanupId }, ConsistentRead: true });
    const { Item } = await awsCall("DynamoDB get cleanup", () => this.#client.send(request));
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
    const request = new PutCommand({
      TableName: this.#table,
      Item: { ...record },
      ConditionExpression: "attribute_not_exists(cleanup_id)",
    });
    await conditionalWrite("DynamoDB put cleanup", () => this.#client.send(request));
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
    await conditionalWrite("DynamoDB finish cleanup", () => this.#client.send(request));
  }
}
