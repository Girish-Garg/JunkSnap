import { ValidationError } from "../domain/errors.js";
import type { QueueMessage } from "../domain/QueueMessage.js";
import type { MessageHandler } from "../ports/MessageHandler.js";

// Sends each message to the handler registered for its `kind`; a new kind is a new entry, not a branch.
export class MessageRouter implements MessageHandler {
  readonly #handlers: ReadonlyMap<string, MessageHandler>;

  constructor(handlers: Readonly<Record<string, MessageHandler>>) {
    this.#handlers = new Map(Object.entries(handlers));
  }

  async handle(message: QueueMessage): Promise<void> {
    const handler = this.#handlers.get(message.kind);
    if (handler === undefined) {
      throw new ValidationError(`no handler for message kind "${message.kind.slice(0, 40)}"`);
    }
    await handler.handle(message);
  }
}
