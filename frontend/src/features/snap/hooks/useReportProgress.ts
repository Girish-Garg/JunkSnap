import { useEffect } from 'react';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { ReportProgress } from '../ReportProgress';
import { useQueue } from './useQueue';

const POLL_MS = 4_000;

/** One queued report, polling GET /reports/{id} while the server is still checking it. */
export function useReportProgress(id: string): QueuedReport | undefined {
  const { snap } = useServices();
  const report = useQueue().find((candidate) => candidate.id === id);
  const polling = report !== undefined && ReportProgress.isChecking(report);
  useEffect(() => {
    if (!polling) return undefined;
    void snap.tracker.refresh(id);
    const timer = window.setInterval(() => void snap.tracker.refresh(id), POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling, id, snap.tracker]);
  return report;
}
