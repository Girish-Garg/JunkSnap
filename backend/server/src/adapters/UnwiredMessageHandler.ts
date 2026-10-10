import { ExternalServiceError } from "../domain/errors.js";
import type { MessageHandler } from "../ports/MessageHandler.js";

// Placeholder for a message kind whose processor is not wired yet; failing keeps the message for the DLQ.
export class UnwiredMessageHandler implements MessageHandler {
  readonly #kind: string;

  constructor(kind: string) {
    this.#kind = kind;
  }

  async handle(): Promise<void> {
    throw new ExternalServiceError(`no processor is wired for ${this.#kind} messages yet`);
  }
}
