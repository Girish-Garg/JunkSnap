import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { Icon } from '../../../ui/Icon';
import { ActivityReportList } from './ActivityReportList';
import { ScanActivityItem } from './ScanActivityItem';

interface ActivityListsProps {
  readonly reports: readonly QueuedReport[];
  readonly scans: readonly QueuedScan[];
}

export function ActivityLists({ reports, scans }: ActivityListsProps) {
  const { t } = useTranslation();
  if (reports.length + scans.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="activity" />
        <p>{t('activity.empty')}</p>
      </div>
    );
  }
  return (
    <>
      {scans.length > 0 && (
        <ul className="report-list" aria-label={t('activity.videos')}>
          {scans.map((scan) => (
            <ScanActivityItem key={scan.id} scan={scan} />
          ))}
        </ul>
      )}
      {reports.length > 0 && <ActivityReportList reports={reports} />}
    </>
  );
}
