import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { Celebration } from '../../../ui/Celebration';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useReportProgress } from '../hooks/useReportProgress';
import { ReportProgress } from '../ReportProgress';
import { RejectionNotice } from './RejectionNotice';
import { ProgressBadge } from './ProgressBadge';
import { ProgressSteps } from './ProgressSteps';
import { ReportThumb } from './ReportThumb';
import { SentStageActions } from './SentStageActions';

interface SentStageProps {
  readonly id: string;
  readonly onAgain: () => void;
}

/** The saved report's journey, live, with the blurred copy once the server has made it. */
export function SentStage({ id, onAgain }: SentStageProps) {
  const { t } = useTranslation();
  const auth = useAuthFlow();
  const report = useReportProgress(id);
  if (!report) return null;
  const blurred = report.data.status?.blurred_url ?? null;
  return (
    <div className="snap-sent">
      {ReportProgress.celebrates(report) && <Celebration />}
      <ProgressSteps done={ReportProgress.stepsDone(report)} />
      <p className="snap-sent__status" role="status">
        <ProgressBadge report={report} />
      </p>
      <RejectionNotice report={report} />
      {report.data.problem === 'sign_in' && (
        <Button variant="text" onClick={() => auth.go('signIn')}>
          {t('snap.signIn')}
        </Button>
      )}
      {blurred && <ReportThumb key={blurred} url={blurred} size="large" />}
      <SentStageActions report={report} onAgain={onAgain} />
    </div>
  );
}
