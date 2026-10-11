import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

// The reports queue (contracts/README.md, SQS). QUEUE_VISIBILITY_SECONDS and QUEUE_MAX_RECEIVE_COUNT mirror the
// queue's own settings in infra; change them together.
const QueueEnv = z
  .object({
    QUEUE_VISIBILITY_SECONDS: z.coerce.number().int().min(1).max(43_200).default(300),
    QUEUE_MAX_RECEIVE_COUNT: z.coerce.number().int().min(1).max(1_000).default(3),
    WORKER_MESSAGE_DEADLINE_MS: z.coerce.number().int().min(1_000).default(240_000),
    // SQS allows 0 to 20 s of long polling and 1 to 10 messages per receive.
    WORKER_WAIT_SECONDS: z.coerce.number().int().min(0).max(20).default(20),
    WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(10).default(10),
  })
  .refine((values) => values.WORKER_MESSAGE_DEADLINE_MS < values.QUEUE_VISIBILITY_SECONDS * 1_000, {
    message: "WORKER_MESSAGE_DEADLINE_MS must be below QUEUE_VISIBILITY_SECONDS, so an abandoned message comes back only after the worker let it go",
  });

export class QueueSettings {
  readonly visibilityMs: number;
  readonly maxReceiveCount: number;
  readonly messageDeadlineMs: number;
  readonly waitSeconds: number;
  readonly batchSize: number;

  private constructor(values: z.output<typeof QueueEnv>) {
    this.visibilityMs = values.QUEUE_VISIBILITY_SECONDS * 1_000;
    this.maxReceiveCount = values.QUEUE_MAX_RECEIVE_COUNT;
    this.messageDeadlineMs = values.WORKER_MESSAGE_DEADLINE_MS;
    this.waitSeconds = values.WORKER_WAIT_SECONDS;
    this.batchSize = values.WORKER_BATCH_SIZE;
    Object.freeze(this);
  }

  static fromEnv(env: Env): QueueSettings {
    return new QueueSettings(parseEnv(QueueEnv, env));
  }

  // The worker merges up to a batch of reports at once, so in each round of conflicts at least one writer wins.
  get mergeAttempts(): number {
    return this.batchSize + 1;
  }
}
