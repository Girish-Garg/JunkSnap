import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { EmptyState } from '../../../ui/EmptyState';
import { ActivityReportList } from './ActivityReportList';
import { ScanActivityItem } from './ScanActivityItem';

interface ActivityListsProps {
  readonly reports: readonly QueuedReport[];
  readonly scans: readonly QueuedScan[];
}

export function ActivityLists({ reports, scans }: ActivityListsProps) {
  const { t } = useTranslation();
  if (reports.length + scans.length === 0) {
    return <EmptyState art="clean" title={t('activity.emptyTitle')} text={t('activity.empty')} />;
  }
  return (
    <>
      {scans.length > 0 && (
        <ul className="report-list stagger" aria-label={t('activity.videos')}>
          {scans.map((scan) => (
            <ScanActivityItem key={scan.id} scan={scan} />
          ))}
        </ul>
      )}
      {reports.length > 0 && <ActivityReportList reports={reports} />}
    </>
  );
}
