import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { CLEANUP_SEND_GATE } from '../../../domain/SiteActionGates';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';
import { useSessionFacts } from '../../actions/hooks/useSessionFacts';
import { GpsPanel } from '../../snap/components/GpsPanel';
import type { CapturedPhoto } from '../../snap/hooks/usePhotoCapture';
import { usePhotoPreview } from '../../snap/hooks/usePhotoPreview';
import type { CleanupFlow } from '../hooks/useCleanup';

interface CleanupReviewProps {
  readonly photo: CapturedPhoto;
  readonly flow: CleanupFlow;
}

/** The reporter's own after-photo appears only here; the site later shows the blurred copy. */
export function CleanupReview({ photo, flow }: CleanupReviewProps) {
  const { t } = useTranslation();
  const preview = usePhotoPreview(photo.bytes);
  const gate = useGate();
  const sendable = CLEANUP_SEND_GATE.decide({ ...useSessionFacts(), busy: flow.busy });
  return (
    <div className="snap-review">
      <div className="snap-review__top">
        <img ref={preview} className="snap-review__photo" alt={t('cleanup.photoAlt')} />
        <GpsPanel gps={{ fix: photo.gps, problem: null }} />
      </div>
      {flow.problem && (
        <p className="form__error" role="alert">
          {t(`cleanup.errors.${flow.problem}`)}
        </p>
      )}
      <div className="snap-actions">
        <Button onClick={gate(sendable, flow.send)} {...lookOf(sendable)}>
          {t(flow.busy ? 'cleanup.sending' : 'cleanup.send')}
        </Button>
        <Button variant="text" onClick={flow.retake}>
          {t('snap.retake')}
        </Button>
      </div>
    </div>
  );
}
