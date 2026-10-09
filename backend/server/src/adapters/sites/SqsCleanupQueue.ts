import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import type { CleanupRecord } from "../../domain/sites/Cleanup.js";
import type { CleanupQueue } from "../../ports/sites/CleanupQueue.js";
import { awsCall } from "./utils.js";

// Shares the reports queue; the worker routes on `kind`.
export class SqsCleanupQueue implements CleanupQueue {
  readonly #client: SQSClient;
  readonly #queueUrl: string;

  constructor(client: SQSClient, queueUrl: string) {
    this.#client = client;
    this.#queueUrl = queueUrl;
  }

  async send(record: CleanupRecord): Promise<void> {
    const { cleanup_id, site_id, upload_id, device_token, sha256, gps, captured_at, received_at } = record;
    const message = { kind: "cleanup", cleanup_id, site_id, upload_id, device_token, sha256, gps, captured_at, received_at };
    const request = new SendMessageCommand({ QueueUrl: this.#queueUrl, MessageBody: JSON.stringify(message) });
    await awsCall("SQS send cleanup", () => this.#client.send(request));
  }
}
