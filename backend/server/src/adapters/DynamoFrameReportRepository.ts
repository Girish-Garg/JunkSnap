import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../domain/errors.js";
import type { FrameReportRepository, QueuedFrameReport } from "../ports/FrameReportRepository.js";

// Writes the same row shape POST /reports stores (DynamoReportRepository.create): upload fields, status, no steps, version 1.
export class DynamoFrameReportRepository implements FrameReportRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async exists(reportId: string): Promise<boolean> {
    const command = new GetCommand({
      TableName: this.#table,
      Key: { report_id: reportId },
      ProjectionExpression: "report_id",
    });
    try {
      const { Item } = await this.#client.send(command);
      return Item !== undefined;
    } catch (error) {
      throw new ExternalServiceError("Could not read the report", { cause: error });
    }
  }

  async createQueued({ report_id, upload, received_at, ...extra }: QueuedFrameReport): Promise<void> {
    const auto = Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined));
    const command = new PutCommand({
      TableName: this.#table,
      Item: { report_id, ...upload, ...auto, received_at, status: "queued", updated_at: received_at, completed_steps: [], version: 1 },
      ConditionExpression: "attribute_not_exists(report_id)",
    });
    try {
      await this.#client.send(command);
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw new ExternalServiceError("Could not store the frame report", { cause: error });
      }
    }
  }
}
