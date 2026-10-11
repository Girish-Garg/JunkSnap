import { ApiError } from '../../domain/ApiError';
import { ReportOutcome } from '../../domain/ReportOutcome';
import type { ReportStatusView } from '../../domain/ReportStatus';

/** The latest read of one report for the "What we checked" view, and how the reads went. */
export interface FeedbackRead {
  readonly reportId: string;
  /** The last report read; a failed re-read keeps it on screen. */
  readonly view: ReportStatusView | null;
  /** Nothing to show: the first read failed. */
  readonly failed: boolean;
  /** Failed reads in a row. */
  readonly failures: number;
  /** The api said 404 or 403: not this user's report, so asking again cannot help. */
  readonly refused: boolean;
}

// The api answers 404 for anyone but the owner, and 403 when it refuses outright.
const REFUSED: ReadonlySet<number> = new Set([403, 404]);

/**
 * When the view reads the report again (every cache.feedbackPollMs): while it is still being checked, and a few times
 * after a failed read.
 */
export class FeedbackPolling {
  static readonly MAX_FAILURES = 3;

  static succeeded(reportId: string, view: ReportStatusView): FeedbackRead {
    return { reportId, view, failed: false, failures: 0, refused: false };
  }

  /** Every read makes a new object, so the next wait always starts again. */
  static failedWith(previous: FeedbackRead | null, reportId: string, error: unknown): FeedbackRead {
    const view = previous?.reportId === reportId ? previous.view : null;
    const failures = previous?.reportId === reportId ? previous.failures + 1 : 1;
    const refused = error instanceof ApiError && REFUSED.has(error.status);
    return { reportId, view, failed: view === null, failures, refused };
  }

  static due(read: FeedbackRead | null): boolean {
    if (read === null || read.refused || read.failures >= FeedbackPolling.MAX_FAILURES) return false;
    if (read.view === null) return read.failed;
    return ReportOutcome.isSettling(ReportOutcome.of(read.view));
  }
}
