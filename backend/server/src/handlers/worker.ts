import type { EventEmitter } from "node:events";
import type { QueuePoller } from "../ports/QueuePoller.js";
import { WorkerLoop } from "../services/WorkerLoop.js";
import { EntryPoint, type EntryContext } from "./EntryPoint.js";
import { buildReportQueuePoller } from "./reportWorker.js";

const STOP_SIGNALS = ["SIGTERM", "SIGINT"] as const;

export type PollerFactory = (context: EntryContext) => QueuePoller | Promise<QueuePoller>;

export async function runWorker(
  context: EntryContext,
  signals: Pick<EventEmitter, "once"> = process,
  buildPoller: PollerFactory = buildReportQueuePoller,
): Promise<void> {
  const { logger } = context;
  // A synchronous factory keeps signal handlers registered before the caller can emit a signal.
  const built = buildPoller(context);
  const loop = new WorkerLoop(built instanceof Promise ? await built : built, logger);
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
