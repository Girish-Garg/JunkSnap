// The poller catches handler errors per message and rethrows only receive or transport failures.
export interface QueuePoller {
  // On abort, stop waiting for new messages but finish the ones already received.
  pollOnce(signal: AbortSignal): Promise<void>;
}
