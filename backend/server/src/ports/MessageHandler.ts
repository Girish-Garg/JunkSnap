import type { QueueMessage } from "../domain/QueueMessage.js";

// Throwing leaves the message on the queue for SQS to retry; returning deletes it.
export interface MessageHandler {
  handle(message: QueueMessage): Promise<void>;
}
