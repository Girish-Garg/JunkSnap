import type { EventEmitter } from "node:events";
import { IdleQueuePoller } from "../adapters/IdleQueuePoller.js";
import type { Logger } from "../ports/Logger.js";
import { WorkerLoop } from "../services/WorkerLoop.js";
import { CoreSettings } from "../settings/CoreSettings.js";
import type { Env } from "../settings/utils.js";
import { createLogger } from "./logger.js";

const LONG_POLL_MS = 20_000;
const STOP_SIGNALS = ["SIGTERM", "SIGINT"] as const;

export interface WorkerParts {
  readonly loop: WorkerLoop;
  readonly logger: Logger;
  readonly signals: Pick<EventEmitter, "once">;
}

export async function runWorker({ loop, logger, signals }: WorkerParts): Promise<void> {
  for (const signal of STOP_SIGNALS) {
    signals.once(signal, () => {
      loop.stop(signal);
    });
  }
  logger.info("worker started");
  await loop.run();
  logger.info("worker stopped");
}

async function main(env: Env): Promise<void> {
  const settings = CoreSettings.fromEnv(env);
  const logger = createLogger({ service: "worker", stage: settings.stage });
  const loop = new WorkerLoop(new IdleQueuePoller(LONG_POLL_MS), logger);
  await runWorker({ loop, logger, signals: process });
}

if (import.meta.main) {
  await main(process.env);
}
