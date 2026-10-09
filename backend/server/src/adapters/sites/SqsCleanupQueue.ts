import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import type { CleanupRecord } from "../../domain/sites/Cleanup.js";
import type { CleanupQueue } from "../../ports/sites/CleanupQueue.js";
import type { AwsCalls } from "./AwsCalls.js";

// Shares the reports queue; the worker routes on `kind`. user_id is left out for a guest.
export class SqsCleanupQueue implements CleanupQueue {
  readonly #client: SQSClient;
  readonly #queueUrl: string;
  readonly #calls: AwsCalls;

  constructor(client: SQSClient, queueUrl: string, calls: AwsCalls) {
    this.#client = client;
    this.#queueUrl = queueUrl;
    this.#calls = calls;
  }

  async send(record: CleanupRecord): Promise<void> {
    const { cleanup_id, site_id, upload_id, device_token, user_id, sha256, gps, captured_at, received_at } = record;
    const user = user_id === null ? {} : { user_id };
    const message = { kind: "cleanup", cleanup_id, site_id, upload_id, device_token, ...user, sha256, gps, captured_at, received_at };
    const request = new SendMessageCommand({ QueueUrl: this.#queueUrl, MessageBody: JSON.stringify(message) });
    await this.#calls.run("SQS send cleanup", () => this.#client.send(request));
  }
}
