// The poller catches handler, deadline and delete failures per message and rethrows only receive failures.
export interface QueuePoller {
  // On abort, stop waiting for new messages but finish the ones already received.
  pollOnce(signal: AbortSignal): Promise<void>;
}
