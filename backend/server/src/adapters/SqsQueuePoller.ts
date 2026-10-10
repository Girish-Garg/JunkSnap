import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type Message,
  type SQSClient,
} from "@aws-sdk/client-sqs";
import { ExternalServiceError, ValidationError } from "../domain/errors.js";
import { QueueMessage } from "../domain/QueueMessage.js";
import type { Logger } from "../ports/Logger.js";
import type { MessageHandler } from "../ports/MessageHandler.js";
import type { QueuePoller } from "../ports/QueuePoller.js";

const WAIT_SECONDS = 20;
const BATCH_SIZE = 10;

export interface SqsPollerOptions {
  readonly queueUrl: string;
  readonly maxReceiveCount: number;
}

// Deletes a message only after its handler succeeds; a failed one becomes visible again and SQS retries it.
export class SqsQueuePoller implements QueuePoller {
  readonly #client: SQSClient;
  readonly #options: SqsPollerOptions;
  readonly #handler: MessageHandler;
  readonly #logger: Logger;

  constructor(client: SQSClient, options: SqsPollerOptions, handler: MessageHandler, logger: Logger) {
    this.#client = client;
    this.#options = options;
    this.#handler = handler;
    this.#logger = logger;
  }

  async pollOnce(signal: AbortSignal): Promise<void> {
    const messages = await this.#receive(signal);
    const results = await Promise.allSettled(messages.map((message) => this.#process(message)));
    const failure = results.find((result) => result.status === "rejected");
    if (failure !== undefined) {
      throw failure.reason;
    }
  }

  async #receive(signal: AbortSignal): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.#options.queueUrl,
      MaxNumberOfMessages: BATCH_SIZE,
      WaitTimeSeconds: WAIT_SECONDS,
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
    });
    try {
      return (await this.#client.send(command, { abortSignal: signal })).Messages ?? [];
    } catch (error) {
      if (signal.aborted) {
        return [];
      }
      throw new ExternalServiceError("Could not receive from the reports queue", { cause: error });
    }
  }

  async #process(message: Message): Promise<void> {
    if (await this.#handled(message)) {
      await this.#delete(message);
    }
  }

  // A poison message only fails itself; the rest of the batch carries on.
  async #handled(message: Message): Promise<boolean> {
    try {
      await this.#handler.handle(this.#parse(message));
      return true;
    } catch (error) {
      const fields = { error, message_id: message.MessageId, receive_count: SqsQueuePoller.#receiveCount(message) };
      this.#logger.error(fields, "message failed; SQS will retry it");
      return false;
    }
  }

  async #delete(message: Message): Promise<void> {
    const command = new DeleteMessageCommand({ QueueUrl: this.#options.queueUrl, ReceiptHandle: message.ReceiptHandle });
    try {
      await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError("Could not delete a handled message", { cause: error });
    }
  }

  #parse(message: Message): QueueMessage {
    const body: unknown = JSON.parse(message.Body ?? "");
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ValidationError("message body is not a JSON object");
    }
    const receiveCount = SqsQueuePoller.#receiveCount(message);
    return new QueueMessage(body as Record<string, unknown>, receiveCount, this.#options.maxReceiveCount);
  }

  static #receiveCount(message: Message): number {
    return Number(message.Attributes?.ApproximateReceiveCount ?? "1");
  }
}
