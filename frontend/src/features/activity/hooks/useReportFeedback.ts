import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import { FeedbackPolling, type FeedbackRead } from '../FeedbackPolling';

export interface ReportFeedbackState {
  readonly view: ReportStatusView | null;
  readonly failed: boolean;
  /** Shows a status an answer returned at once; reading again resumes while it is being checked. */
  readonly replace: (view: ReportStatusView) => void;
}

/**
 * Reads the user's own report (GET /reports/{id} answers only its owner), and again every few
 * seconds while it is still being checked or after a failed read (FeedbackPolling decides).
 */
export function useReportFeedback(reportId: string): ReportFeedbackState {
  const { snap } = useServices();
  const [read, setRead] = useState<FeedbackRead | null>(null);
  const [round, setRound] = useState(0);
  const again = useCallback(() => setRound((count) => count + 1), []);
  const replace = useCallback((view: ReportStatusView) => setRead(FeedbackPolling.succeeded(reportId, view)), [reportId]);
  useEffect(() => {
    let current = true;
    snap.tracker.read(reportId).then(
      (view) => {
        if (current) setRead(FeedbackPolling.succeeded(reportId, view));
      },
      (error: unknown) => {
        console.error(`Could not read report ${reportId}`, error);
        if (current) setRead((previous) => FeedbackPolling.failedWith(previous, reportId, error));
      },
    );
    return () => {
      current = false;
    };
  }, [snap.tracker, reportId, round]);
  const mine = read?.reportId === reportId ? read : null;
  useNextRead(mine, again);
  return { view: mine?.view ?? null, failed: mine?.failed ?? false, replace };
}

// Each finished read is a new object, so the wait restarts after every read, failed or not.
function useNextRead(read: FeedbackRead | null, again: () => void): void {
  const due = FeedbackPolling.due(read);
  useEffect(() => {
    if (!due) return undefined;
    const timer = window.setTimeout(again, FeedbackPolling.INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [due, read, again]);
}
