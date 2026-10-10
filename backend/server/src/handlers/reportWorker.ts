import type { QueuePoller } from "../ports/QueuePoller.js";
import type { EntryContext } from "./EntryPoint.js";
import { WorkerDeps } from "./worker/WorkerDeps.js";
import { WorkerGraph } from "./worker/WorkerGraph.js";

// The worker's object graph: every step is built by its own factory under handlers/worker/.
export async function buildReportQueuePoller(context: EntryContext): Promise<QueuePoller> {
  return new WorkerGraph(new WorkerDeps(context)).poller();
}
