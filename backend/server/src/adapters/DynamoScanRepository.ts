import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../domain/errors.js";
import type { ScanRecord, ScanUpdate } from "../domain/ScanRecord.js";
import type { ScanRepository } from "../ports/ScanRepository.js";

export class DynamoScanRepository implements ScanRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async create(record: ScanRecord): Promise<boolean> {
    const command = new PutCommand({
      TableName: this.#table,
      Item: record,
      ConditionExpression: "attribute_not_exists(scan_id)",
    });
    try {
      await this.#client.send(command);
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return false;
      }
      throw new ExternalServiceError("Could not store the scan", { cause: error });
    }
  }

  async find(scanId: string): Promise<ScanRecord | undefined> {
    try {
      const { Item } = await this.#client.send(new GetCommand({ TableName: this.#table, Key: { scan_id: scanId } }));
      return Item as ScanRecord | undefined;
    } catch (error) {
      throw new ExternalServiceError("Could not read the scan", { cause: error });
    }
  }

  // Placeholders for every name, since status is a DynamoDB reserved word.
  async update(scanId: string, update: ScanUpdate): Promise<void> {
    const entries = Object.entries(update);
    const command = new UpdateCommand({
      TableName: this.#table,
      Key: { scan_id: scanId },
      UpdateExpression: `SET ${entries.map((_entry, i) => `#f${i} = :v${i}`).join(", ")}`,
      ExpressionAttributeNames: Object.fromEntries(entries.map(([name], i) => [`#f${i}`, name])),
      ExpressionAttributeValues: Object.fromEntries(entries.map(([, value], i) => [`:v${i}`, value])),
      ConditionExpression: "attribute_exists(scan_id)",
    });
    try {
      await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError("Could not update the scan", { cause: error });
    }
  }

  // Conditional, so a slower duplicate delivery can never undo a scan another delivery finished.
  async recordReports(scanId: string, reportIds: readonly string[], updatedAt: string): Promise<boolean> {
    const command = new UpdateCommand({
      TableName: this.#table,
      Key: { scan_id: scanId },
      UpdateExpression: "SET report_ids = :ids, updated_at = :at",
      ConditionExpression: "attribute_exists(scan_id) AND NOT (#status IN (:done, :failed))",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":ids": reportIds, ":at": updatedAt, ":done": "done", ":failed": "failed" },
    });
    try {
      await this.#client.send(command);
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return false;
      }
      throw new ExternalServiceError("Could not record the scan's frame reports", { cause: error });
    }
  }
}
