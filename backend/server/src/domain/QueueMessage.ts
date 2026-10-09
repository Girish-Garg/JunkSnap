// One SQS delivery: the parsed JSON body and how many times SQS has handed it out.
export class QueueMessage {
  readonly #body: Readonly<Record<string, unknown>>;
  readonly receiveCount: number;
  readonly #maxReceiveCount: number;

  constructor(body: Readonly<Record<string, unknown>>, receiveCount: number, maxReceiveCount: number) {
    this.#body = body;
    this.receiveCount = receiveCount;
    this.#maxReceiveCount = maxReceiveCount;
  }

  get kind(): string {
    const kind = this.#body.kind;
    return typeof kind === "string" ? kind : "";
  }

  field(name: string): unknown {
    return this.#body[name];
  }

  // A failure on this receive moves the message to the dead-letter queue.
  isLastAttempt(): boolean {
    return this.receiveCount >= this.#maxReceiveCount;
  }
}
