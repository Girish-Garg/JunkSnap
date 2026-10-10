import { useTranslation } from 'react-i18next';
import { feedbackPath, sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { Button } from '../../../ui/Button';
import { ActivityDelete } from './ActivityDelete';

/** What we checked, open the merged site, retry a waiting or refused report, or delete the row (decision 20261010-1700). */
export function ActivityActions({ report }: { readonly report: QueuedReport }) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const { snap } = useServices();
  const siteId = report.data.status?.site_id;
  const reportId = report.data.stage === 'sent' ? report.data.report_id : null;
  const waiting = report.data.problem !== null;
  return (
    <div className="report-row__actions">
      {reportId && (
        <Button variant="text" onClick={() => sheets.open(feedbackPath(reportId))}>
          {t('feedback.open')}
        </Button>
      )}
      {siteId && (
        <Button variant="text" onClick={() => sheets.open(sitePath(siteId))}>
          {t('activity.openSite')}
        </Button>
      )}
      {waiting && (
        <Button variant="text" onClick={() => void snap.queue.retry((other) => other.id === report.id)}>
          {t('activity.retry')}
        </Button>
      )}
      <ActivityDelete target={{ report }} />
    </div>
  );
}
