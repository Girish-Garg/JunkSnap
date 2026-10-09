import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCamera, type CameraState } from '../hooks/useCamera';
import type { GpsState } from '../hooks/useGpsFix';
import type { SnapFlow } from '../hooks/useSnapFlow';
import { GpsChip } from './GpsChip';
import { PhoneCameraButton } from './PhoneCameraButton';
import { SnapFooter } from './SnapFooter';

interface CameraStageProps {
  readonly flow: SnapFlow;
  readonly gps: GpsState;
}

// The line over the viewfinder: saving, a capture problem, or why the camera is not live.
function viewfinderMessage(camera: CameraState, capture: SnapFlow['capture']): string | null {
  if (capture.busy) return 'snap.saving';
  if (capture.problem) return `snap.${capture.problem}`;
  return camera === 'live' ? null : `snap.${camera}`;
}

export function CameraStage({ flow, gps }: CameraStageProps) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const camera = useCamera(video);
  const { capture } = flow;
  const live = camera === 'live';
  const message = viewfinderMessage(camera, capture);
  const shoot = () => {
    if (video.current) capture.fromVideo(video.current);
  };
  return (
    <div className="snap-camera">
      <div className="viewfinder">
        <video ref={video} className="viewfinder__video" playsInline muted aria-hidden="true" />
        {message && (
          <p className="viewfinder__message" role="status">
            {t(message)}
          </p>
        )}
        <GpsChip gps={gps} />
      </div>
      <div className={live ? 'snap-camera__controls' : 'snap-camera__controls snap-camera__controls--fallback'}>
        {live && <button type="button" className="shutter" aria-label={t('snap.shutter')} disabled={capture.busy} onClick={shoot} />}
        <PhoneCameraButton onFile={capture.fromFile} primary={!live} />
      </div>
      <SnapFooter />
    </div>
  );
}
