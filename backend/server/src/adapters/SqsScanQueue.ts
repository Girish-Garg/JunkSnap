import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import { ExternalServiceError } from "../domain/errors.js";
import type { ScanQueue } from "../ports/ScanQueue.js";

type QueueMessage =
  | { readonly kind: "scan"; readonly scan_id: string }
  | { readonly kind: "report"; readonly report_id: string };

export class SqsScanQueue implements ScanQueue {
  readonly #client: SQSClient;
  readonly #queueUrl: string;

  constructor(client: SQSClient, queueUrl: string) {
    this.#client = client;
    this.#queueUrl = queueUrl;
  }

  async sendScan(scanId: string): Promise<void> {
    await this.#send({ kind: "scan", scan_id: scanId });
  }

  async sendReport(reportId: string): Promise<void> {
    await this.#send({ kind: "report", report_id: reportId });
  }

  async #send(message: QueueMessage): Promise<void> {
    const command = new SendMessageCommand({ QueueUrl: this.#queueUrl, MessageBody: JSON.stringify(message) });
    try {
      await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError(`Could not queue the ${message.kind} message`, { cause: error });
    }
  }
}
