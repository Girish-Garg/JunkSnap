import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { Button } from '../../../ui/Button';
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
  const { sendable } = flow;
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
        <Button onClick={sendable.tap(flow.send)} {...lookOf(sendable.availability)}>
          {t(flow.busy ? 'cleanup.sending' : 'cleanup.send')}
        </Button>
        <Button variant="text" onClick={flow.retake}>
          {t('snap.retake')}
        </Button>
      </div>
    </div>
  );
}
