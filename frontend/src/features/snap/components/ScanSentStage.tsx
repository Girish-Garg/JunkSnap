import { useTranslation } from 'react-i18next';
import { ACTIVITY_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { Button } from '../../../ui/Button';
import { Celebration } from '../../../ui/Celebration';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useScanProgress } from '../hooks/useScanProgress';
import { SCAN_STEPS, ScanProgress } from '../ScanProgress';
import { ProgressSteps } from './ProgressSteps';
import { ScanStatusLine } from './ScanStatusLine';

interface ScanSentStageProps {
  readonly id: string;
  /** The camera froze and ended the recording early; the clip up to then was saved. */
  readonly cameraStopped: boolean;
  readonly onAgain: () => void;
}

/** The recording's journey, live, ending with how many frame reports the worker made. */
export function ScanSentStage({ id, cameraStopped, onAgain }: ScanSentStageProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const auth = useAuthFlow();
  const scan = useScanProgress(id);
  if (!scan) return null;
  return (
    <div className="snap-sent">
      {cameraStopped && (
        <p className="form__note" role="status">
          {t('scan.cameraStopped')}
        </p>
      )}
      {scan.data.problem === null && scan.data.stage !== 'failed' && <Celebration />}
      <ProgressSteps done={ScanProgress.stepsDone(scan)} steps={SCAN_STEPS} keyPrefix="scan.steps" />
      <ScanStatusLine scan={scan} />
      {scan.data.problem === 'sign_in' && (
        <Button variant="text" onClick={() => auth.go('signIn')}>
          {t('snap.signIn')}
        </Button>
      )}
      <div className="snap-actions">
        <Button onClick={onAgain}>{t('scan.again')}</Button>
        <Button variant="text" onClick={() => sheets.swap(ACTIVITY_PATH)}>
          {t('snap.seeActivity')}
        </Button>
      </div>
    </div>
  );
}
