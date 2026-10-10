import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ACTIVITY_PATH } from '../../../app/paths';
import { Button } from '../../../ui/Button';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useScanProgress } from '../hooks/useScanProgress';
import { SCAN_STEPS, ScanProgress } from '../ScanProgress';
import { ProgressSteps } from './ProgressSteps';
import { ScanStatusLine } from './ScanStatusLine';

interface ScanSentStageProps {
  readonly id: string;
  readonly onAgain: () => void;
}

/** The recording's journey, live, ending with how many frame reports the worker made. */
export function ScanSentStage({ id, onAgain }: ScanSentStageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuthFlow();
  const scan = useScanProgress(id);
  if (!scan) return null;
  return (
    <div className="snap-sent">
      <ProgressSteps done={ScanProgress.stepsDone(scan)} steps={SCAN_STEPS} keyPrefix="scan.steps" />
      <ScanStatusLine scan={scan} />
      {scan.data.problem === 'sign_in' && (
        <Button variant="text" onClick={() => auth.go('signIn')}>
          {t('snap.signIn')}
        </Button>
      )}
      <div className="snap-actions">
        <Button onClick={onAgain}>{t('scan.again')}</Button>
        <Button variant="text" onClick={() => navigate(ACTIVITY_PATH)}>
          {t('snap.seeActivity')}
        </Button>
      </div>
    </div>
  );
}
