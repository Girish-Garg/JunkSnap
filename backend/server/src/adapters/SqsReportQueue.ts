import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import { ExternalServiceError } from "../domain/errors.js";
import type { ReportQueue } from "../ports/ReportQueue.js";

export class SqsReportQueue implements ReportQueue {
  readonly #client: SQSClient;
  readonly #queueUrl: string;

  constructor(client: SQSClient, queueUrl: string) {
    this.#client = client;
    this.#queueUrl = queueUrl;
  }

  async sendReport(reportId: string): Promise<void> {
    const body = JSON.stringify({ kind: "report", report_id: reportId });
    try {
      await this.#client.send(new SendMessageCommand({ QueueUrl: this.#queueUrl, MessageBody: body }));
    } catch (error) {
      throw new ExternalServiceError("Could not queue the report", { cause: error });
    }
  }
}
