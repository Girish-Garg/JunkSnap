import { useTranslation } from 'react-i18next';
import { SNAP_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { QueuedReport } from '../../../domain/QueuedReport';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { ActivityLoading } from './ActivityLoading';
import { ActivityReportList } from './ActivityReportList';
import { ScanActivityItem } from './ScanActivityItem';
import '../activity.css';

interface ActivityListsProps {
  readonly reports: readonly QueuedReport[];
  readonly scans: readonly QueuedScan[];
  /** The first sync is on its way: an empty list shows placeholders, not "Nothing sent yet". */
  readonly loading: boolean;
}

export function ActivityLists({ reports, scans, loading }: ActivityListsProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  if (reports.length + scans.length === 0) {
    if (loading) return <ActivityLoading />;
    const first = (
      <Button variant="sun" onClick={() => sheets.swap(SNAP_PATH)}>
        {t('activity.firstPhoto')}
      </Button>
    );
    return <EmptyState art="clean" title={t('activity.emptyTitle')} text={t('activity.empty')} action={first} />;
  }
  return (
    <>
      {scans.length > 0 && (
        <ul className="activity-list stagger" aria-label={t('activity.videos')}>
          {scans.map((scan) => (
            <ScanActivityItem key={scan.id} scan={scan} />
          ))}
        </ul>
      )}
      {reports.length > 0 && <ActivityReportList reports={reports} />}
    </>
  );
}
