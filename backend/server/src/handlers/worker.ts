import type { EventEmitter } from "node:events";
import type { QueuePoller } from "../ports/QueuePoller.js";
import { WorkerLoop } from "../services/WorkerLoop.js";
import { EntryPoint, type EntryContext } from "./EntryPoint.js";
import { buildReportQueuePoller } from "./reportWorker.js";

const STOP_SIGNALS = ["SIGTERM", "SIGINT"] as const;

export type PollerFactory = (context: EntryContext) => QueuePoller;

export async function runWorker(
  context: EntryContext,
  signals: Pick<EventEmitter, "once"> = process,
  buildPoller: PollerFactory = buildReportQueuePoller,
): Promise<void> {
  const { logger } = context;
  const loop = new WorkerLoop(buildPoller(context), logger);
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
