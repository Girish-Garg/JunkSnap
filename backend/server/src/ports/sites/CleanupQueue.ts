import type { CleanupRecord } from "../../domain/sites/Cleanup.js";

export interface CleanupQueue {
  // Sends the cleanup message in contracts/README.md (SQS) to the worker.
  send(record: CleanupRecord): Promise<void>;
}
