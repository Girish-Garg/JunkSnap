import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import { useGpsFix } from '../hooks/useGpsFix';
import { useSnapFlow, type SnapPhase } from '../hooks/useSnapFlow';
import '../snap.css';
import { CameraStage } from './CameraStage';
import { ReviewStage } from './ReviewStage';
import { SentStage } from './SentStage';

const TITLE_ID = 'snap-title';

const TITLES: Readonly<Record<SnapPhase['kind'], string>> = {
  camera: 'snap.title',
  review: 'snap.reviewTitle',
  sent: 'snap.sentTitle',
};

/** Camera, then type and place, then the report's progress. GPS runs until the report is saved. */
export function SnapRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/'), [navigate]);
  const flow = useSnapFlow();
  const { phase } = flow;
  const gps = useGpsFix(phase.kind !== 'sent');
  return (
    <BottomSheet
      labelledBy={TITLE_ID}
      closeLabel={t('snap.close')}
      resizeLabel={t('sheet.resize')}
      onClose={close}
      initial="full"
      focusKey={phase.kind}
    >
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t(TITLES[phase.kind])}
      </h2>
      {phase.kind === 'camera' && <CameraStage flow={flow} gps={gps} />}
      {phase.kind === 'review' && <ReviewStage key={phase.photo.sha256} photo={phase.photo} flow={flow} />}
      {phase.kind === 'sent' && <SentStage id={phase.id} onAgain={flow.restart} />}
    </BottomSheet>
  );
}
