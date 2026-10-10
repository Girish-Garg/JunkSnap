import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ACTIVITY_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import '../../snap/snap.css';
import '../feedback.css';
import { useReportFeedback } from '../hooks/useReportFeedback';
import { FeedbackContent } from './FeedbackContent';
import { FeedbackPending } from './FeedbackPending';

const TITLE_ID = 'feedback-title';

/** "What we checked" for one of the user's own reports: why it was accepted, sent to neighbours or turned down. */
export function ReportFeedbackRoute() {
  const { t } = useTranslation();
  const { reportId = '' } = useParams();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close(ACTIVITY_PATH), [sheets]);
  const { view, failed, replace } = useReportFeedback(reportId);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('feedback.close')} resizeLabel={t('sheet.resize')} onClose={close} initial="full">
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('feedback.title')}
      </h2>
      {view ? <FeedbackContent view={view} onAnswered={replace} /> : <FeedbackPending failed={failed} />}
    </BottomSheet>
  );
}
