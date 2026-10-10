import { useTranslation } from 'react-i18next';
import { ACTIVITY_PATH, feedbackPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { Button } from '../../../ui/Button';

interface SentStageActionsProps {
  readonly report: QueuedReport;
  readonly onAgain: () => void;
}

/** After Send: another photo, what the server checked once it has the report, or the whole Activity list. */
export function SentStageActions({ report, onAgain }: SentStageActionsProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const reportId = report.data.stage === 'sent' ? report.data.report_id : null;
  return (
    <div className="snap-actions">
      <Button onClick={onAgain}>{t('snap.again')}</Button>
      {reportId && (
        <Button variant="text" onClick={() => sheets.swap(feedbackPath(reportId))}>
          {t('feedback.open')}
        </Button>
      )}
      <Button variant="text" onClick={() => sheets.swap(ACTIVITY_PATH)}>
        {t('snap.seeActivity')}
      </Button>
    </div>
  );
}
