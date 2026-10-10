import { useTranslation } from 'react-i18next';
import { ACTIVITY_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { Button } from '../../../ui/Button';
import { Celebration } from '../../../ui/Celebration';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useReportProgress } from '../hooks/useReportProgress';
import { ReportProgress } from '../ReportProgress';
import { ProgressBadge } from './ProgressBadge';
import { ProgressSteps } from './ProgressSteps';
import { ReportThumb } from './ReportThumb';

interface SentStageProps {
  readonly id: string;
  readonly onAgain: () => void;
}

/** The saved report's journey, live, with the blurred copy once the server has made it. */
export function SentStage({ id, onAgain }: SentStageProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const auth = useAuthFlow();
  const report = useReportProgress(id);
  if (!report) return null;
  const blurred = report.data.status?.blurred_url ?? null;
  return (
    <div className="snap-sent">
      {report.data.problem === null && report.data.stage !== 'failed' && <Celebration />}
      <ProgressSteps done={ReportProgress.stepsDone(report)} />
      <p className="snap-sent__status" role="status">
        <ProgressBadge report={report} />
      </p>
      {report.data.problem === 'sign_in' && (
        <Button variant="text" onClick={() => auth.go('signIn')}>
          {t('snap.signIn')}
        </Button>
      )}
      {blurred && <ReportThumb key={blurred} url={blurred} size="large" />}
      <div className="snap-actions">
        <Button onClick={onAgain}>{t('snap.again')}</Button>
        <Button variant="text" onClick={() => sheets.swap(ACTIVITY_PATH)}>
          {t('snap.seeActivity')}
        </Button>
      </div>
    </div>
  );
}
