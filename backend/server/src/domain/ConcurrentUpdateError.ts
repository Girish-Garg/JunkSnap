import { JunkSnapError } from "./errors.js";

// Another writer saved the item after we read it; the caller lets SQS retry once that writer is done.
export class ConcurrentUpdateError extends JunkSnapError {}
