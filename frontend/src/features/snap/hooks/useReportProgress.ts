import { useEffect } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { ReportProgress } from '../ReportProgress';
import { useQueue } from './useQueue';

/** One queued report, polling GET /reports/{id} while the server is still checking it. */
export function useReportProgress(id: string): QueuedReport | undefined {
  const { snap } = useServices();
  const { reportPollMs } = useConfig().cache;
  const report = useQueue().find((candidate) => candidate.id === id);
  const polling = report !== undefined && ReportProgress.isChecking(report);
  useEffect(() => {
    if (!polling) return undefined;
    void snap.tracker.refresh(id);
    const timer = window.setInterval(() => void snap.tracker.refresh(id), reportPollMs);
    return () => window.clearInterval(timer);
  }, [polling, id, snap.tracker, reportPollMs]);
  return report;
}
