import { useTranslation } from 'react-i18next';
import { feedbackPath, sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { Button } from '../../../ui/Button';
import { ActivityRow } from '../ActivityRow';
import { ActivityDelete } from './ActivityDelete';

/**
 * One compact row: What we checked (tonal, the main action), Open site when there is one, Try again for a
 * waiting or refused report, and Delete as a small trash button with its confirm step (decision 20261010-1700).
 */
export function ActivityActions({ report }: { readonly report: QueuedReport }) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const { snap } = useServices();
  const siteId = report.data.status?.site_id;
  // A no-bin report has no photo check to show.
  const reportId = report.data.stage === 'sent' && !ActivityRow.isNoBin(report) ? report.data.report_id : null;
  const waiting = report.data.problem !== null;
  return (
    <div className="activity-card__actions">
      {reportId && (
        <Button variant="tonal" size="small" onClick={() => sheets.open(feedbackPath(reportId))}>
          {t('feedback.open')}
        </Button>
      )}
      {siteId && (
        <Button variant="text" size="small" onClick={() => sheets.open(sitePath(siteId))}>
          {t('activity.openSite')}
        </Button>
      )}
      {waiting && (
        <Button variant="text" size="small" onClick={() => void snap.queue.retry((other) => other.id === report.id)}>
          {t('activity.retry')}
        </Button>
      )}
      <ActivityDelete target={{ report }} />
    </div>
  );
}
