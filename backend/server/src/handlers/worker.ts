import type { EventEmitter } from "node:events";
import { IdleQueuePoller } from "../adapters/IdleQueuePoller.js";
import { WorkerLoop } from "../services/WorkerLoop.js";
import { EntryPoint, type EntryContext } from "./EntryPoint.js";

const LONG_POLL_MS = 20_000;
const STOP_SIGNALS = ["SIGTERM", "SIGINT"] as const;

export async function runWorker(
  { logger }: EntryContext,
  signals: Pick<EventEmitter, "once"> = process,
): Promise<void> {
  const loop = new WorkerLoop(new IdleQueuePoller(LONG_POLL_MS), logger);
  for (const signal of STOP_SIGNALS) {
    signals.once(signal, () => {
      loop.stop(signal);
    });
  }
  logger.info("worker started");
  await loop.run();
  logger.info("worker stopped");
}

if (import.meta.main) {
  await new EntryPoint({ service: "worker" }).run(process.env, runWorker);
}
