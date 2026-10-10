import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { ReportOutcome } from '../../../domain/ReportOutcome';
import type { ReportStatusView } from '../../../domain/ReportStatus';

// A report still being checked, or one that could not be read, is read again after this long.
const RECHECK_MS = 5_000;

export interface ReportFeedbackState {
  readonly view: ReportStatusView | null;
  readonly failed: boolean;
}

interface ReadResult extends ReportFeedbackState {
  readonly reportId: string;
}

// A failed re-read keeps the report already on screen; a failed first read says so.
function keepOrFail(previous: ReadResult | null, reportId: string): ReadResult {
  return previous?.reportId === reportId && previous.view ? previous : { reportId, view: null, failed: true };
}

/** Reads the user's own report (GET /reports/{id} answers only its owner), again while it is still being checked. */
export function useReportFeedback(reportId: string): ReportFeedbackState {
  const { snap } = useServices();
  const [result, setResult] = useState<ReadResult | null>(null);
  const [round, setRound] = useState(0);
  const again = useCallback(() => setRound((count) => count + 1), []);
  useEffect(() => {
    let current = true;
    snap.tracker.read(reportId).then(
      (view) => {
        if (current) setResult({ reportId, view, failed: false });
      },
      (error: unknown) => {
        console.error(`Could not read report ${reportId}`, error);
        if (current) setResult((previous) => keepOrFail(previous, reportId));
      },
    );
    return () => {
      current = false;
    };
  }, [snap.tracker, reportId, round]);
  const shown = shownFor(result, reportId);
  useRecheck(shown, again);
  return shown;
}

// Only the result for the report asked for; a stale one from another id is never shown.
function shownFor(result: ReadResult | null, reportId: string): ReportFeedbackState {
  if (result?.reportId !== reportId) return { view: null, failed: false };
  return { view: result.view, failed: result.failed };
}

// Reads again while the report is still being checked, and after a failed first read (offline, a timeout).
function useRecheck({ view, failed }: ReportFeedbackState, again: () => void): void {
  const due = failed || (view !== null && ReportOutcome.isSettling(ReportOutcome.of(view)));
  useEffect(() => {
    if (!due) return undefined;
    const timer = window.setTimeout(again, RECHECK_MS);
    return () => window.clearTimeout(timer);
    // Each fresh read is a new view, which starts the next wait.
  }, [due, view, again]);
}
