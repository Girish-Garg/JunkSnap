import type { SendProblem } from './QueuedReport';

/** The fields every queued upload (photo or video) keeps in IndexedDB. */
export interface QueueItemData {
  readonly id: string;
  readonly saved_at: string;
  readonly attempts: number;
  readonly problem: SendProblem | null;
  readonly retry_at: string | null;
}

/** What UploadQueue needs from a queued photo or video; transitions return new values. */
export interface QueueItem<Self, Data extends QueueItemData> {
  readonly id: string;
  readonly data: Data;
  isDue(now: Date): boolean;
  isPending(): boolean;
  retryNow(): Self;
  failed(problem: SendProblem, retryAt: Date | null): Self;
}
